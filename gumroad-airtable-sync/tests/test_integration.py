from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import pytest

from reconcile import reconcile as project


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def fake_api(monkeypatch):
    monkeypatch.setenv("GUMROAD_ACCESS_TOKEN", "fake+gumroad")
    monkeypatch.setenv("AIRTABLE_TOKEN", "fake-airtable")
    monkeypatch.setenv("AIRTABLE_BASE_ID", "appExample")
    monkeypatch.setenv("AIRTABLE_TABLE", "Sales / 2026")
    monkeypatch.setattr(project.time, "sleep", lambda seconds: None)
    pages = json.loads((ROOT / "tests/fixtures/api-pages.json").read_text(encoding="utf-8"))
    calls = []

    def request(service, method, url, *, token=None, body=None):
        endpoint = urlsplit(url)
        query = dict(parse_qsl(endpoint.query))
        assert endpoint.scheme == "https"
        if service == "Gumroad":
            assert endpoint.netloc == "api.gumroad.com"
            assert endpoint.path == "/v2/sales"
            assert method == "GET" and token is None and body is None
            assert query.pop("access_token") == "fake+gumroad"
            assert query in ({}, {"page_key": "sales+page=2"})
            calls.append((service, method, query))
            return deepcopy(pages["gumroad"][int(bool(query))])

        assert service == "Airtable" and token == "fake-airtable"
        assert endpoint.netloc == "api.airtable.com"
        assert endpoint.path == "/v0/appExample/Sales%20%2F%202026"
        if method == "GET":
            assert body is None
            assert query.pop("pageSize") == "100"
            assert query in ({}, {"offset": "itr fake/next"})
            calls.append((service, method, query))
            return deepcopy(pages["airtable"][int(bool(query))])

        assert method == "PATCH" and not query
        calls.append((service, method, deepcopy(body)))
        records = [{"id": "recMissing", "fields": row["fields"]} for row in body["records"]]
        pages["airtable"][1]["records"].extend(records)
        return {"records": records}

    return request, calls, pages


def test_report_finds_all_three_discrepancies_across_pages(fake_api, capsys):
    request, calls, _ = fake_api
    assert project.main([], request=request) == 1
    assert capsys.readouterr().out.splitlines() == [
        "MISSING sale-missing",
        "WRONG_AMOUNT sale-wrong row=recWrong expected=2000 actual=1000",
        "DUPLICATE sale-duplicate rows=2",
        "Checked 4 sales and 4 rows. Missing: 1. Wrong amounts: 1. Duplicates: 1.",
    ]
    assert calls == [
        ("Gumroad", "GET", {}),
        ("Gumroad", "GET", {"page_key": "sales+page=2"}),
        ("Airtable", "GET", {}),
        ("Airtable", "GET", {"offset": "itr fake/next"}),
    ]


def test_fix_upserts_only_missing_sale_with_exact_body(fake_api, capsys):
    request, calls, _ = fake_api
    assert project.main(["--fix"], request=request) == 1
    assert "Upsert confirmed for 1 missing sale(s)." in capsys.readouterr().out
    assert [call for call in calls if call[1] == "PATCH"] == [
        ("Airtable", "PATCH", {
            "performUpsert": {"fieldsToMergeOn": ["sale_id"]},
            "records": [{"fields": {
                "sale_id": "sale-missing",
                "buyer_email": "missing@example.test",
                "sale_timestamp": "2026-11-17T11:00:00.000Z",
                "amount_cents": 725,
                "product_id": "product-beta",
                "product_name": "Sample Beta",
                "currency": "USD",
                "refunded": False,
                "test": False,
            }}],
        }),
    ]

    calls.clear()
    assert project.main(["--fix"], request=request) == 1
    assert "MISSING" not in capsys.readouterr().out
    assert all(method == "GET" for _, method, _ in calls)


def test_refunded_ping_and_api_sale_map_to_same_fields_and_replay_one_row(fake_api):
    _, _, pages = fake_api
    ping = dict(parse_qsl(pages["ping"]))
    api_sale = pages["gumroad"][1]["sales"][0]
    first = project.sale_fields(ping)
    replay = project.sale_fields(ping)
    assert first == replay == project.sale_fields(api_sale)
    assert first == {
        "sale_id": "sale-refunded",
        "buyer_email": "refund+test@example.test",
        "sale_timestamp": "2026-11-17T03:56:00.000Z",
        "amount_cents": 1500,
        "product_id": "product-beta",
        "product_name": "Sample Beta",
        "currency": "USD",
        "refunded": True,
        "test": True,
    }

    # Model Airtable's single-field merge in memory.
    table = {}
    for fields in (first, replay):
        table.setdefault(fields["sale_id"], {}).update(fields)
    assert table == {"sale-refunded": first}
    assert table["sale-refunded"]["refunded"] is True


def test_fix_records_refunded_sale_when_its_row_is_missing(fake_api):
    request, calls, pages = fake_api
    pages["airtable"][1]["records"].pop()
    assert project.main(["--fix"], request=request) == 1
    body = calls[-1][2]
    assert body["records"][0]["fields"]["sale_id"] == "sale-refunded"
    assert body["records"][0]["fields"]["refunded"] is True


def test_clean_result_after_repair(fake_api):
    request, _, pages = fake_api
    pages["airtable"][0]["records"][1]["fields"]["amount_cents"] = 2000
    pages["airtable"][1]["records"].pop(0)
    assert project.main(["--fix"], request=request) == 1
    assert project.main([], request=request) == 0


def test_api_failure_is_not_reported_as_clean(fake_api, capsys):
    request, calls, pages = fake_api
    pages["gumroad"][1] = {"success": False}
    assert project.main(["--fix"], request=request) == 2
    assert "Gumroad did not return a successful sales page" in capsys.readouterr().err
    assert all(service == "Gumroad" for service, _, _ in calls)


def test_fix_requires_airtable_confirmation(fake_api, capsys):
    request, _, _ = fake_api

    def incomplete_upsert(service, method, url, **options):
        if method == "PATCH":
            return {"records": []}
        return request(service, method, url, **options)

    assert project.main(["--fix"], request=incomplete_upsert) == 2
    captured = capsys.readouterr()
    assert "Upsert confirmed" not in captured.out
    assert "Airtable did not confirm all upserted records" in captured.err


def test_invalid_amount_is_rejected():
    with pytest.raises(ValueError, match="price must be an integer in cents"):
        project.sale_fields({"sale_id": "sale-invalid", "price": "7.25"})


def test_workflow_webhook_waits_for_keyed_upsert():
    workflow = json.loads((ROOT / "n8n/gumroad-to-airtable.json").read_text(encoding="utf-8"))
    nodes = {node["type"]: node for node in workflow["nodes"]}
    hook = nodes["n8n-nodes-base.webhook"]
    mapping = nodes["n8n-nodes-base.code"]
    airtable = nodes["n8n-nodes-base.httpRequest"]
    assert hook["parameters"]["httpMethod"] == "POST"
    assert hook["parameters"]["responseMode"] == "lastNode"
    assert hook["parameters"]["responseData"] == "noData"
    assert workflow["connections"][hook["name"]]["main"][0][0]["node"] == mapping["name"]
    assert workflow["connections"][mapping["name"]]["main"][0][0]["node"] == airtable["name"]
    assert airtable["parameters"]["method"] == "PATCH"
    assert airtable["parameters"]["url"].startswith("https://api.airtable.com/v0/")
    assert airtable["parameters"]["jsonBody"] == "={{ JSON.stringify($json) }}"
    assert "performUpsert: { fieldsToMergeOn: ['sale_id'] }" in mapping["parameters"]["jsCode"]
    assert airtable["credentials"] == {"airtableTokenApi": {"name": "Airtable Personal Access Token"}}
