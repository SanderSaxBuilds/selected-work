# Test results

Sample build, not a client job. All cases ran against a real local n8n 2.46.6 on 2026-11-05T18:09:19.514Z, driven by tests/run-tests.mjs. CRM, model, messaging and alert endpoints are the local mock in mock/server.mjs, and every fault is a real HTTP response from that mock.

Result: 18 of 18 cases passed, 97 checks in total. Executions recorded by n8n in this instance: 154.

| Case | Result | Time |
|---|---|---|
| T1 Happy path | PASS | 1.4s |
| T2 Malformed input | PASS | 2.5s |
| T3 Duplicate lead | PASS | 8.2s |
| T4 CRM 500 then recovery | PASS | 8.3s |
| T5 CRM permanent 400 | PASS | 10.2s |
| T6 AI failure uses fixed rules | PASS | 19.4s |
| T7 CRM down for the whole retry window, then replay (extra) | PASS | 18.3s |
| T8 Rate limit 429 honours Retry-After (extra) | PASS | 6.4s |
| T9 Thin submission goes to review (extra) | PASS | 5.8s |
| T10 Send accepted, reply lost, no double send (extra) | PASS | 5.4s |
| T11 Two identical submissions at the same moment (extra) | PASS | 4.2s |
| T12 Interrupted execution, n8n killed mid retry (extra) | PASS | 37.2s |
| T13 Unexpected failure reaches the Error Handler (extra) | PASS | 5.6s |
| T14 Alert channel down (extra) | PASS | 5.3s |
| T15 Follow-up permanent failure resumes after the CRM step (extra) | PASS | 3.4s |
| T16 Cold or opted out leads get no message (extra) | PASS | 6.9s |
| T17 Team notification failure does not fail the lead (extra) | PASS | 1.4s |
| T18 Lead stuck in processing with no recovery event (extra) | PASS | 1.5s |

## T1 Happy path: PASS

- ok, webhook answers 202 accepted. Observed: `202 {"status":"accepted","leadId":"lead_8dc5e133ff01b603"}`
- ok, lead row ends completed. Observed: `completed`
- ok, email normalised to lower case. Observed: `mixed.case.mw3uxrxo@example.com`
- ok, phone normalised. Observed: `+14155550101`
- ok, qualified by the model. Observed: `model, tier hot, score 90`
- ok, one CRM record. Observed: `crm_0003`
- ok, one follow-up message. Observed: `msg_0003`
- ok, team notified. Observed: `1`
- ok, no alerts. Observed: `0`
- ok, ledger key marked sent. Observed: `followup:lead_8dc5e133ff01b603:welcome-v1 sent`
- Note: Budget string "$1,500" became 1500.

## T2 Malformed input: PASS

- ok, no contact route: 422 with reason. Observed: `422 ["no usable contact route"]`
- ok, bad email: 422 with reason. Observed: `422 ["email is not valid: not-an-email","no usable contact route"]`
- ok, array body: 422 with reason. Observed: `422 ["body is not a JSON object","no usable contact route"]`
- ok, broken JSON body gets a client error. Observed: `422 {"code":422,"message":"Failed to parse request body","hint":"Expected ',' or '}' after property value in JSON at positio`
- ok, nothing reached model, CRM or messaging. Observed: `0 requests`
- ok, rejections are logged for review. Observed: `3 rejected rows in total`

## T3 Duplicate lead: PASS

- ok, same lead resubmitted answers 200 duplicate. Observed: `200 {"status":"duplicate","leadId":"lead_77b16fa4632cdc93","existingStatus":"completed"}`
- ok, same email in another case is a duplicate. Observed: `duplicate`
- ok, new email, same phone is a duplicate. Observed: `duplicate`
- ok, model called once. Observed: `1`
- ok, CRM written once. Observed: `version 1`
- ok, one message. Observed: `1`
- Note: Dedupe runs before the model, so a duplicate costs no model call.

## T4 CRM 500 then recovery: PASS

- ok, form gets 202 straight away. Observed: `202`
- ok, three CRM attempts: 500, 500, 201. Observed: `500,500,201`
- ok, backoff grew between attempts. Observed: `2.2s, 4.4s`
- ok, lead completed. Observed: `completed`
- ok, one CRM record, one message. Observed: `1, 1`
- ok, no dead letter, no alert. Observed: `0, 0`
- Note: Observed wait between attempts: 2.2s, 4.4s.

## T5 CRM permanent 400: PASS

- ok, exactly one CRM attempt, no retry. Observed: `400`
- ok, lead marked dead_letter. Observed: `dead_letter`
- ok, dead letter row written. Observed: `lead_bcc4514c608fe37c:crm, permanent, retryable false`
- ok, dead letter keeps the original payload. Observed: `{"name":"Test crm400","email":"crm400.mw3uxrxo@example.com",`
- ok, operator alerted. Observed: `action_needed, sent`
- ok, no follow-up sent. Observed: `0`
- ok, replay skips a permanent failure until a person clears it. Observed: `{"replayed":0,"accepted":0,"rejected":0}, CRM records 0`
- ok, operator clears it in the table. Observed: `200`
- ok, replay then completes the lead. Observed: `completed, dead letter resolved`
- ok, one CRM record, one message after recovery. Observed: `1, 1`
- Note: Alert text: Permanent rejection. Fix the record, set retryable to true, then run Replay.

## T6 AI failure uses fixed rules: PASS

- ok, model 503 twice: lead completed on fixed rules. Observed: `completed, fixed_rules, tier hot, score 80`
- ok, model 503 twice: CRM record says why. Observed: `fixed rules used, model call failed: 503 - "{\"error\":\"mock_fault\",\"status\":503}"`
- ok, model 503 twice: message still sent once. Observed: `1`
- ok, model hangs past the timeout: lead completed on fixed rules. Observed: `completed, fixed_rules, tier hot, score 80`
- ok, model hangs past the timeout: CRM record says why. Observed: `fixed rules used, model call failed: timeout of 4000ms exceeded`
- ok, model hangs past the timeout: message still sent once. Observed: `1`
- ok, model answers text, not JSON: lead completed on fixed rules. Observed: `completed, fixed_rules, tier hot, score 80`
- ok, model answers text, not JSON: CRM record says why. Observed: `fixed rules used, model call failed: unknown`
- ok, model answers text, not JSON: message still sent once. Observed: `1`
- ok, model JSON fails the schema: lead completed on fixed rules. Observed: `completed, fixed_rules, tier hot, score 80`
- ok, model JSON fails the schema: CRM record says why. Observed: `fixed rules used, model reply failed the schema check`
- ok, model JSON fails the schema: message still sent once. Observed: `1`
- Note: The model node retries once, so one bad reply followed by a good one simply uses the good one. These faults hit both tries.
- Note: A failed model call is not a dead letter. The lead keeps moving, and the CRM record shows the rules were used.

## T7 CRM down for the whole retry window, then replay (extra): PASS

- ok, four attempts then stop. Observed: `503,503,503,503`
- ok, dead letter is retryable. Observed: `temporary, retryable true, attempts 4`
- ok, operator alerted once. Observed: `1`
- ok, a plain resubmission does not restart a dead letter. Observed: `duplicate`
- ok, replay completes the lead. Observed: `completed, resolved`
- ok, one record, one message. Observed: `1, 1`
- Note: Observed wait between attempts: 2.0s, 4.4s, 8.5s.

## T8 Rate limit 429 honours Retry-After (extra): PASS

- ok, 429 then 201. Observed: `429,201`
- ok, waited at least the 5 seconds the provider asked for. Observed: `5.0s`
- Note: Default first backoff is 2 seconds, observed 5.0s.

## T9 Thin submission goes to review (extra): PASS

- ok, 202 needs_review with reasons. Observed: `202 ["name missing","message too short"]`
- ok, stored as needs_review. Observed: `needs_review`
- ok, no model, CRM or message. Observed: `0`
- ok, the same person sending full details is processed. Observed: `accepted`
- ok, then completes. Observed: `completed`

## T10 Send accepted, reply lost, no double send (extra): PASS

- ok, two calls: 502, then replay answer. Observed: `502 (message accepted, reply lost), 200 (idempotent replay, nothing sent)`
- ok, only one message exists. Observed: `1`
- ok, provider saw the same key twice. Observed: `followup:lead_4d39772f13edbc19:welcome-v1`
- ok, lead completed. Observed: `completed`
- Note: This is the worst case for double sends. The retry reuses the key, so the provider answers without sending.

## T11 Two identical submissions at the same moment (extra): PASS

- ok, still one message. Observed: `1`
- ok, still one CRM record. Observed: `1 record, version 2`
- Note: Answers: accepted, accepted. Provider replays absorbed: 1.

## T12 Interrupted execution, n8n killed mid retry (extra): PASS

- ok, n8n was killed and restarted. Observed: `0`
- ok, n8n recovery fires the Error Handler. Observed: `dead_letter, lead_383a2baacc6fd407:unhandled`
- ok, classed as interrupted and safe to replay. Observed: `interrupted, retryable true`
- ok, operator alerted. Observed: `Run was interrupted. Every step is safe to repeat, so run Replay.`
- ok, replay finishes the lead. Observed: `{"replayed":1,"accepted":1,"rejected":0}, completed, resolved`
- ok, one CRM record, one message. Observed: `1, 1`
- Note: CRM calls seen: 500, 201. The first 500 was before the kill, n8n then recovered the run as crashed.

## T13 Unexpected failure reaches the Error Handler (extra): PASS

- ok, lead marked dead_letter. Observed: `dead_letter`
- ok, error workflow found the lead by execution id. Observed: `lead_ca86fcf7a7e3d495:unhandled`
- ok, reason names the failing node. Observed: `Stop - CRM Contract Broken, CRM answered 200 without a record id for lead_ca86fcf7a7e3d495`
- ok, operator alerted. Observed: `1`
- ok, no message sent. Observed: `0`

## T14 Alert channel down (extra): PASS

- ok, three alert tries. Observed: `3`
- ok, dead letter survives and is flagged. Observed: `open, failed`
- Note: The record is written before the alert, so a dead alert channel cannot lose a failed lead.

## T15 Follow-up permanent failure resumes after the CRM step (extra): PASS

- ok, dead letter at the follow-up stage. Observed: `followup, permanent`
- ok, CRM record already stored. Observed: `crm_0017`
- ok, replay finishes it. Observed: `completed`
- ok, CRM not written again, model not called again. Observed: `version 1, model calls 1`
- ok, one message. Observed: `1`

## T16 Cold or opted out leads get no message (extra): PASS

- ok, cold lead stored in CRM. Observed: `cold`
- ok, opted out lead stored in CRM. Observed: `hot`
- ok, neither was contacted. Observed: `0`

## T17 Team notification failure does not fail the lead (extra): PASS

- ok, lead completed anyway. Observed: `completed`
- ok, no dead letter. Observed: `0`
- ok, message still sent once. Observed: `1`

## T18 Lead stuck in processing with no recovery event (extra): PASS

- ok, row planted as a half finished lead. Observed: `200`
- ok, a plain resubmission does not start a second run. Observed: `duplicate`
- ok, sweep finds it and finishes it. Observed: `{"replayed":1,"accepted":1,"rejected":0}, completed`
- ok, one CRM record, one message. Observed: `1, 1`
- Note: The row was inserted by the test to stand in for a run that vanished without n8n recording it. T12 covers the real kill.
