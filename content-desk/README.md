# Restaurant Content Desk

A restaurant agency producing 200+ pieces a month needs to see which pieces are late and get new briefs ready for production. This desk sends owners a weekday Slack digest and drafts three captions and a shot list for each new Brief. Open [demo/index.html](demo/index.html) to see eight pieces with the late ones marked, and one drafted brief.

## Notion setup

Use one database with one data source. Share it with a Notion integration that can read and update pages. Create these properties with the exact names below.

| Property | Type | Values or use |
| --- | --- | --- |
| Name | Title | Piece title |
| Status | Status | Brief, Shoot, Edit, Client review, Scheduled. Final statuses such as Published are ignored. |
| Owner | Person | Exactly one person per piece |
| Due | Date | Deadline as a single date with time disabled |
| Stage changed | Date | Date the current status began, with time disabled |
| Restaurant | Text | Restaurant name |
| Dish or offer | Text | Dish, promotion, or other subject |
| Platform | Select | Destination, such as Instagram Reels |
| Tone notes | Text | Optional voice and wording notes |
| AI draft | Select | Empty for a new brief. Create options `ready`, `edited`, and `failed`. |
| Captions | Text | The three options written by the workflow |
| Shot list | Text | The shots written by the workflow |

Set `Stage changed` when you create a piece and whenever `Status` changes. The digest runs at 09:00 Toronto time Monday to Friday. A piece is overdue after its due date. Stage age counts Monday to Friday after the stage start date, including today. The limits are Brief 1, Shoot 3, Edit 2, Client review 2, and Scheduled 0. A piece is stuck when it exceeds its limit. An empty date omits that check. Holidays count as weekdays.

## n8n and Slack setup

1. Import [n8n/content-desk.json](n8n/content-desk.json) into n8n. The schedule uses the workflow's `America/Toronto` time zone. The brief poll runs every five minutes.
2. Create three Header Auth credentials. Name them `Notion Content Desk`, `OpenAI Compatible Content Desk`, and `Slack Content Desk`. Use `Authorization` as the header name and `Bearer <token>` as its value. Select each credential in the matching HTTP nodes. The Slack workspace bot needs `im:write` and `chat:write` to open DMs and post messages.
3. In `Desk Settings`, set the Notion database ID, the chat completions URL, a model that supports JSON mode, and `firstBriefCreatedAt` in UTC as `YYYY-MM-DDTHH:mm:ssZ`. This cutoff selects new briefs by creation time. Map each Notion person's ID to their Slack member ID. Complete the brief fields when you create the page.
4. Serialize production executions on the n8n instance running this workflow to prevent overlapping polls. For regular self-hosted mode on a dedicated instance, set `N8N_CONCURRENCY_PRODUCTION_LIMIT=1`. Enable the workflow when the settings and credentials are in place.

## Draft failures

Invalid JSON, an invalid response shape, and request failures get one retry. After a second failure, n8n sets `AI draft` to `failed` and DMs the owner once. Incomplete briefs go straight to the same failure path. Fix the brief and clear `AI draft` to requeue an eligible failed piece. The workflow reads the page again before any draft write and skips pages with a populated draft status, a changed brief, or a different stage. Notion has no conditional page update, so keep manual draft changes on `ready` or `edited` pages to avoid a race with the final write.

Notion and Slack errors appear in the execution log. If a DM fails after the status write, check the execution before retrying any delivery. A successful digest contains one message per owner with late pieces. Owners with no late pieces receive no message.

### Workflow paths

```text
Weekday 09:00 Toronto -> Desk Settings
Poll for New Briefs -> Desk Settings
Desk Settings -> Build Calendar Query -> Query Notion Calendar -> Collect Calendar Page -> More Calendar Pages?
More Calendar Pages? [true] -> Build Calendar Query
More Calendar Pages? [false] -> Digest Run?
Digest Run? [true] -> Build Owner Digests -> Resolve Slack Owner
Digest Run? [false] -> Queue Briefs -> Build Draft Request -> Brief Complete?
Brief Complete? [true] -> Call LLM -> Validate First Response -> First Draft Valid?
Brief Complete? [false] -> Plan Draft Outcome
First Draft Valid? [true] -> Plan Draft Outcome
First Draft Valid? [false] -> Retry LLM Once -> Validate Retry Response -> Plan Draft Outcome
Plan Draft Outcome -> Get Latest Draft State -> Prepare Notion Update -> Still Eligible?
Still Eligible? [true] -> Update Notion Draft -> Verify Notion Update -> Draft Failed?
Draft Failed? [true] -> Resolve Slack Owner
Resolve Slack Owner -> Open Owner DM -> Build Slack Message -> Post Slack Message -> Verify Slack Delivery
```

## Offline tests

With Python 3.11 or newer and pytest installed, run `python -m pytest -q` from this directory. The tests run on recorded fixtures and make no API calls.
