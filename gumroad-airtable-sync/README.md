# Gumroad sales to Airtable

The n8n workflow receives Gumroad Ping sale notifications and saves them in Airtable. It waits for Airtable to accept the write before returning success. Airtable matches each upsert on `sale_id`, so replaying the same sale updates its row. The Python check compares Airtable with the Gumroad Sales API to catch missed writes, incorrect amounts and duplicate rows.

## Set up Airtable

Create a table with these exact field names.

| Field | Airtable type |
| --- | --- |
| `sale_id` | Single line text, preferably the primary field |
| `buyer_email` | Email |
| `sale_timestamp` | Date, with Include time enabled |
| `amount_cents` | Number, integer precision |
| `product_id` | Single line text |
| `product_name` | Single line text |
| `currency` | Single line text |
| `refunded` | Checkbox |
| `test` | Checkbox |

Use an Airtable personal access token with access to the base and the `data.records:read` and `data.records:write` scopes. Remove any existing duplicate sale IDs before activation, since Airtable may reject upserts with more than one match.

## Connect and verify

1. Import `n8n/gumroad-to-airtable.json` into n8n. In **Gumroad Ping**, replace the sample path with a random UUID. Keep the production URL private since it accepts POSTs without a sign-in.
2. In **Upsert Airtable sale**, replace `REPLACE_BASE_ID` and `REPLACE_TABLE_ID`. Create or select an Airtable Personal Access Token credential in n8n and save the workflow.
3. Activate or publish the workflow, then copy the Webhook node's **Production URL** into the Ping URL setting in Gumroad and save it.
4. While signed in to Gumroad as the seller, open your product page and complete Gumroad's test purchase flow. In Airtable, find the sale and check its ID, buyer email, timestamp, amount in cents and product ID. Check the `test` box when Gumroad supplies a true test flag. A successful checkout is only verified for this integration once its row appears.
5. If the seller test does not emit a Ping, send a sample form POST to verify the n8n-to-Airtable path. Replace `YOUR_PRODUCTION_WEBHOOK_URL` with the private URL. Run the command twice and confirm Airtable has one row with `sale_id` set to `sample-001`.

```sh
curl --fail --data-urlencode 'sale_id=sample-001' --data-urlencode 'sale_timestamp=2026-11-17T10:00:00Z' --data-urlencode 'email=buyer@example.test' --data-urlencode 'price=725' --data-urlencode 'product_id=sample-product' --data-urlencode 'currency=usd' --data-urlencode 'refunded=false' --data-urlencode 'test=true' 'YOUR_PRODUCTION_WEBHOOK_URL'
```

The mapping uses Gumroad's `sale_id` (or Sales API `id`), converts the timestamp to UTC, and stores `price` as integer cents. A sale payload with `refunded` set to true or `1` is saved as refunded. For a refund that happens later, the row reflects the new status when it receives an upsert with the updated flag.

## Run the daily check

Set `GUMROAD_ACCESS_TOKEN` (with the `view_sales` scope), `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, and `AIRTABLE_TABLE` (table ID or name) in the environment. Use Python 3.11 or newer. Run this command from the project folder, or schedule it daily in cron or Task Scheduler and alert on a nonzero exit.

```sh
python reconcile/reconcile.py
```

Add `--fix` to upsert missing sales. The command reports wrong amounts and duplicates for manual review. It exits `0` for a clean check, `1` when it finds discrepancies (including sales repaired in that run), and `2` when the check or repair fails. Run it again after a repair to confirm the missing sales are gone.

Run the offline tests with `python -m pytest -q`.
