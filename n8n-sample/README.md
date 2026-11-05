# n8n lead intake, sample build

This is a sample build, not a client job. It shows how we handle failure in n8n: lead intake for a small service business, with validation, dedupe, AI qualification with a fixed rules fallback, CRM sync, one follow-up message and a full failure path.

The CRM, model, messaging and alert endpoints are local mocks in `mock/server.mjs`. They are not real providers. The errors are still real HTTP responses, so n8n handles them the way it would handle a real outage. No real credentials, keys or client data are in this folder.

Built and tested on n8n 2.46.6 with Node 26. 18 of 18 test cases passed, see `TESTS.md`. The walkthrough is `n8n-lead-intake-walkthrough.mp4`, the narration is `script.txt`.

## Workflows

| File in workflows/ | Workflow | Job |
|---|---|---|
| lead-intake-main.json | Lead Intake - Main | Intake, dedupe, qualify, CRM, follow-up |
| lead-intake-dead-letter-and-alert.json | Lead Intake - Dead Letter And Alert | Stores the failure, then alerts the operator |
| lead-intake-error-handler.json | Lead Intake - Error Handler | Catches anything no branch expected |
| lead-intake-dead-letter-replay.json | Lead Intake - Dead Letter Replay | Posts open failures back through intake |

Flow of a good lead:

Webhook, Normalise and Validate, Hash Lead Key, Find Existing Lead, Save As Processing, Respond 202, Qualify Lead, CRM retry loop, Check Eligibility, Check Ledger, Reserve Send Key, Follow-up retry loop, Notify Team, Mark Completed.

The webhook answers before the slow work starts, so the form is never held open by a CRM outage.

## Naming

Every node reads as `Area - Verb Object`, such as `CRM - Upsert Lead`, `Follow-up - Check Ledger` or `Dead Letter - Build Record`. The area is the stage, so a failed run names its stage and action without opening the node.

## How failures are handled

| Failure | What happens |
|---|---|
| Malformed input | 422 with field errors, logged in `dead_letters` as rejected, no lead row, no model call |
| Duplicate lead | 200 duplicate, matched on email or phone before the model is called |
| Too little to qualify | 202 needs review, stored for a person |
| Model down, timed out or bad JSON | Fixed rules score the lead, the record shows which one scored it |
| CRM or send 408, 425, 429, 5xx or network error | Up to 4 attempts, backoff 2, 4, 8 seconds plus 10 percent jitter, Retry-After wins |
| CRM or send other 4xx | Permanent, skips the loop, goes straight to the dead letter |
| Retries used up | Dead letter row, operator alert with the next step, replay later |
| CRM says OK but sends no record id | The run stops on purpose, the Error Handler writes the dead letter and alerts |
| Team notification fails | Logged, the lead still completes |
| Alert channel down | The dead letter is written first, marked alert failed, so the failure is kept |
| Unexpected crash | Error Handler builds a dead letter and alerts, with a direct last resort call if that fails too |
| n8n killed mid run | Crash recovery fires the Error Handler, classed `interrupted`, retryable |
| Lead stuck in processing | The timed sweep picks up rows older than 10 minutes |

## No double sends

The key `followup:<leadId>:welcome-v1` is reserved in `followup_ledger` before the send, and the same key goes to the provider as `Idempotency-Key`. A retry after a lost reply sends nothing (T10). A replay checks the ledger and skips a message already sent. The CRM write is a PUT by lead id, so repeating it updates one record.

## Data tables

| Table | Columns |
|---|---|
| leads | lead_id, email, phone, name, status, stage, tier, score, qualified_by, crm_id, execution_id, last_error, payload |
| followup_ledger | idempotency_key, lead_id, status, provider_message_id, execution_id |
| dead_letters | dead_letter_id, stage, error_class, http_status, attempts, retryable, status, alert_status, reason, payload, lead_id, execution_id |

Workflows reference the tables by name, so create tables with these names before the first run. `scripts/setup-instance.mjs` does this on a local instance.

## Run it locally

The scripts assume Git Bash. `scripts/ctl.sh` finds its own folder.

1. `npm install --ignore-scripts`, then `npm rebuild sqlite3`. A native Kafka module has no Node 26 build, and this sample does not use it.
2. `bash scripts/ctl.sh start`, this starts n8n on 127.0.0.1:5678 and the mock on 127.0.0.1:4010.
3. `node scripts/setup-instance.mjs`, this creates a throwaway local owner and the data tables.
4. `bash scripts/ctl.sh deploy`, this builds, imports and publishes the four workflows.
5. `node tests/run-tests.mjs`, this runs all cases and rewrites `TESTS.md`. It wipes the tables first.
6. `bash scripts/ctl.sh stop`.

To import by hand, import in this order, since the main workflow calls the others by id: dead letter, error handler, replay, main. Then publish each one.

The mock console is at http://127.0.0.1:4010. `POST /__fault` queues failures, for example `{"service":"crm","faults":[{"status":503,"times":99}]}`.

`recording/` holds the scripts that recorded the video. They need Playwright with Chromium and the narration audio made from `script.txt`.

## Before a real deployment

- Replace the local URLs in `Config - Endpoints and Limits`, `Config - Alert Endpoint`, `Alert - Last Resort Direct Call` and `Replay - Define Scope`.
- Add authentication to the intake and replay webhooks. In this sample they are open and bound to localhost only.
- Store real CRM, model and messaging keys as n8n credentials, never in node parameters.
- Change the CRM call to the real API shape. Most need a search then create or update, or an external id field.
- Tune attempts and backoff to the provider. The 14 second window here is short so that tests run fast.
- Point alerts at a channel the operator actually reads, and add retention for leads and dead letters.

## Known limits

- n8n Data Tables have no unique constraint here. Two identical submissions at the same moment can both pass dedupe. In T11 the CRM upsert and the provider key absorbed the second run, so one record and one message came out. A provider with no idempotency keys would leave a small double send window, and a real database with a unique key on the ledger would close it.
- The mock model is deterministic. Real model replies vary, so the reply check and the prompt need testing on real data.
- Only one follow-up message is built, `welcome-v1`. A sequence would add one ledger key per step.
- The timed sweep was seen firing once on its schedule, with success. T18 tests the stale lead path through the replay webhook, not through the timer.
- All tests ran on one local machine with SQLite, not under production load.
