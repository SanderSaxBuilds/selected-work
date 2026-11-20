"""Compare Gumroad sales with Airtable and optionally upsert missing sales."""

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


GUMROAD_URL = "https://api.gumroad.com/v2/sales"
AIRTABLE_URL = "https://api.airtable.com/v0"
TIMESTAMP = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]"
    r"(?:\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])"
)


class ApiError(Exception):
    """An API request or response prevented a complete comparison."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(service, method, url, *, token=None, body=None):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as exc:
        raise ApiError(f"{service} {method} returned HTTP {exc.code}") from None
    except (URLError, OSError, ValueError):
        raise ApiError(f"{service} {method} failed or returned invalid JSON") from None
    if not isinstance(result, dict):
        raise ApiError(f"{service} {method} did not return a JSON object")
    return result


def clean_text(value):
    return value.strip() if isinstance(value, str) else ""


def flag(value):
    return value is True or value == 1 or clean_text(value).lower() in {"true", "1"}


def sale_fields(sale):
    """Map a parsed Gumroad Ping or Sales API item to Airtable field values."""
    sale_id = clean_text(sale.get("sale_id")) or clean_text(sale.get("id"))
    if not sale_id:
        raise ValueError("sale_id is required")

    price = sale.get("price")
    if type(price) is int:
        amount_cents = price
    elif isinstance(price, str) and re.fullmatch(r"-?[0-9]+", price.strip()):
        amount_cents = int(price.strip())
    else:
        raise ValueError("price must be an integer in cents")
    if abs(amount_cents) > 2**53 - 1:
        raise ValueError("price is outside the safe integer range")

    timestamp = clean_text(sale.get("sale_timestamp")) or clean_text(sale.get("created_at"))
    if not TIMESTAMP.fullmatch(timestamp):
        raise ValueError("sale_timestamp must be an ISO 8601 timestamp with a timezone")
    try:
        utc_timestamp = datetime.fromisoformat(timestamp).astimezone(timezone.utc)
    except (ValueError, OverflowError):
        raise ValueError("sale_timestamp is invalid") from None

    fields = {
        "sale_id": sale_id,
        "sale_timestamp": utc_timestamp.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "amount_cents": amount_cents,
        "refunded": flag(sale.get("refunded")),
        "test": flag(sale.get("test")),
    }
    for name, value in (
        ("buyer_email", clean_text(sale.get("email")) or clean_text(sale.get("purchaser_email"))),
        ("product_id", clean_text(sale.get("product_id"))),
        ("product_name", clean_text(sale.get("product_name"))),
        ("currency", clean_text(sale.get("currency")).upper()),
    ):
        if value:
            fields[name] = value
    return fields


def read_gumroad(request, token):
    page_key = None
    seen_keys = set()
    while True:
        query = {"access_token": token}
        if page_key:
            query["page_key"] = page_key
        response = request("Gumroad", "GET", f"{GUMROAD_URL}?{urlencode(query)}")
        sales = response.get("sales")
        if response.get("success") is not True or not isinstance(sales, list):
            raise ApiError("Gumroad did not return a successful sales page")
        for sale in sales:
            if not isinstance(sale, dict):
                raise ApiError("Gumroad returned a malformed sale")
            yield sale_fields(sale)

        page_key = response.get("next_page_key")
        next_url = response.get("next_page_url")
        if not page_key and next_url:
            if not isinstance(next_url, str):
                raise ApiError("Gumroad returned an invalid next page URL")
            page_key = parse_qs(urlsplit(next_url).query).get("page_key", [None])[0]
            if not page_key:
                raise ApiError("Gumroad's next page URL had no page_key")
        if not page_key:
            return
        if not isinstance(page_key, str) or page_key in seen_keys:
            raise ApiError("Gumroad returned an invalid or repeated page_key")
        seen_keys.add(page_key)


class Airtable:
    def __init__(self, request, token, base, table):
        self.request = request
        self.token = token
        self.url = f"{AIRTABLE_URL}/{quote(base, safe='')}/{quote(table, safe='')}"
        self.next_request_at = 0.0

    def call(self, method, query=None, body=None):
        delay = self.next_request_at - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        self.next_request_at = time.monotonic() + 0.22
        url = f"{self.url}?{urlencode(query)}" if query else self.url
        return self.request("Airtable", method, url, token=self.token, body=body)

    def rows(self):
        query = {"pageSize": 100}
        seen_offsets = set()
        while True:
            response = self.call("GET", query=query)
            records = response.get("records")
            if not isinstance(records, list):
                raise ApiError("Airtable did not return a records page")
            for record in records:
                if not isinstance(record, dict) or not isinstance(record.get("fields"), dict):
                    raise ApiError("Airtable returned a malformed record")
                yield record
            offset = response.get("offset")
            if not offset:
                return
            if not isinstance(offset, str) or offset in seen_offsets:
                raise ApiError("Airtable returned an invalid or repeated offset")
            seen_offsets.add(offset)
            query["offset"] = offset

    def upsert(self, sales):
        for start in range(0, len(sales), 10):
            batch = sales[start:start + 10]
            body = {
                "performUpsert": {"fieldsToMergeOn": ["sale_id"]},
                "records": [{"fields": fields} for fields in batch],
            }
            response = self.call("PATCH", body=body)
            records = response.get("records")
            if not isinstance(records, list) or len(records) != len(batch):
                raise ApiError("Airtable did not confirm all upserted records")
            expected = {sale["sale_id"]: sale for sale in batch}
            for record in records:
                fields = record.get("fields") if isinstance(record, dict) else None
                if not isinstance(fields, dict):
                    raise ApiError("Airtable returned a malformed upserted record")
                sale_id = fields.get("sale_id")
                sale = expected.pop(sale_id, None) if isinstance(sale_id, str) else None
                actual = fields.get("amount_cents")
                if (sale is None or type(actual) not in (int, float) or actual != sale["amount_cents"]
                        or flag(fields.get("refunded")) != sale["refunded"]):
                    raise ApiError("Airtable's upsert response did not match the submitted sale")


def compare(sales, records):
    by_sale_id = defaultdict(list)
    for record in records:
        fields = record["fields"]
        sale_id = fields.get("sale_id")
        if isinstance(sale_id, str) and sale_id:
            by_sale_id[sale_id].append(record)

    missing = []
    wrong_amounts = []
    for sale in sales:
        sale_id = sale["sale_id"]
        matches = by_sale_id.get(sale_id, [])
        if not matches:
            missing.append(sale)
        for record in matches:
            actual = record["fields"].get("amount_cents")
            if type(actual) not in (int, float) or actual != sale["amount_cents"]:
                wrong_amounts.append((sale_id, record.get("id", "?"), sale["amount_cents"], actual))

    duplicates = [(sale_id, len(rows)) for sale_id, rows in by_sale_id.items() if len(rows) > 1]
    return missing, wrong_amounts, duplicates


def main(argv=None, *, request=request_json):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fix", action="store_true", help="Upsert missing sales only")
    args = parser.parse_args(argv)

    names = ("GUMROAD_ACCESS_TOKEN", "AIRTABLE_TOKEN", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE")
    config = {name: clean_text(os.environ.get(name)) for name in names}
    unset = [name for name, value in config.items() if not value]
    if unset:
        print(f"Set these environment variables: {', '.join(unset)}", file=sys.stderr)
        return 2

    airtable = Airtable(request, config["AIRTABLE_TOKEN"], config["AIRTABLE_BASE_ID"], config["AIRTABLE_TABLE"])
    try:
        sales = {sale["sale_id"]: sale for sale in read_gumroad(request, config["GUMROAD_ACCESS_TOKEN"])}
        records = list(airtable.rows())
        missing, wrong_amounts, duplicates = compare(sales.values(), records)
        for sale in missing:
            print(f"MISSING {sale['sale_id']}")
        for sale_id, record_id, expected, actual in wrong_amounts:
            print(f"WRONG_AMOUNT {sale_id} row={record_id} expected={expected} actual={actual}")
        for sale_id, count in duplicates:
            print(f"DUPLICATE {sale_id} rows={count}")
        print(f"Checked {len(sales)} sales and {len(records)} rows. "
              f"Missing: {len(missing)}. Wrong amounts: {len(wrong_amounts)}. Duplicates: {len(duplicates)}.")

        if args.fix and missing:
            airtable.upsert(missing)
            print(f"Upsert confirmed for {len(missing)} missing sale(s).")
    except (ApiError, ValueError) as exc:
        print(f"Check failed: {exc}", file=sys.stderr)
        return 2

    return int(bool(missing or wrong_amounts or duplicates))


if __name__ == "__main__":
    sys.exit(main())
