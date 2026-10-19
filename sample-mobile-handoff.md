# Clearline mobile expense review

Speculative sample for a public brief that asked for a refresh of an existing mobile app. Clearline, its team and its expenses are fictional. This is not the buyer's app and it was not commissioned.

Live page: [sample-mobile.html](sample-mobile.html)

## What it does

- Overview of the month: total spent against a 4,000 USD budget, recalculated from the expense list, with counts and amounts awaiting review and approved.
- Activity list with search across merchant, category and teammate, plus status filters for all, to review, approved and needs correction. Each filter shows its count.
- Expense detail with date, submitter, receipt state and note. Approve or request a correction, then undo the last decision if needed.
- Reset restores the sample month.

Focus moves to the heading of each new screen. Escape steps back from a detail to the activity list. Decision feedback is announced to screen readers. State lives in memory only, with no storage, account, backend or payment.

## Design notes

- Type: Inter Tight for headings, Inter for text, JetBrains Mono for amounts and counts.
- Colors: ink #13201b, paper #f6f5f0, brand green #175841, deep green #0e3b2b, amber #d9a441 for items awaiting review, error #b4412f for corrections, lime #c9df96 for the budget meter.
- Spacing on a 4 px scale, card radius 14 px, buttons 10 to 12 px. Every control is at least 44 px tall.
- The phone frame is 420 px wide at most. On a phone the frame fills the screen width and the intro text sits above it.

## Inputs needed for a real refresh

The current screens or source, the target sections and devices, the existing design system, the expected editable format, the known UX problems and the acceptance criteria. Scope is agreed before a fixed quote. The budget band shown on the public listing is the buyer's advertised range, not an agreed price. HTML, CSS and reviewed visual exports are available. Native Figma or Adobe files are only promised once the needed format is confirmed.

Public brief: https://www.workana.com/job/mobile-app-ui-ux-design-enhancement-for-existing-application
