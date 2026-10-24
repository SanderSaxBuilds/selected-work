# Clearline mobile expense review

Speculative sample for a public brief that asked for a refresh of an existing mobile app. Clearline, its team and its expenses are fictional. This is not the buyer's app and it was not commissioned.

Live page: [sample-mobile.html](sample-mobile.html)

## What it does

- Review queue: eleven sample receipts, eight waiting, shown largest first as a paper receipt with line items and a total worked out from those lines. Drag a receipt right to approve it or left to send it back, or use the buttons. Later moves a receipt to the end of the queue. A progress bar marks each decision in green or red.
- Policy checks on every receipt: no receipt, meals over 75 USD without an itemized bill, same merchant and amount within seven days, and weekend spending.
- Budget impact on every receipt: what approving does to its category limit, including when it would go over.
- Send back opens a sheet with reasons, the ones that match the flags marked as suggested, and an optional note. Sending without a reason shows an error. Approving a receipt with nothing attached needs a note for the auditor of at least 8 characters.
- Undo from the header, the toast or the Z key. Reopen any decided expense from the ledger.
- Ledger with search across merchant, category and teammate, filters for all, to review, approved, sent back and flagged with counts, an empty state that clears the search, and a detail sheet with the receipt and its history.
- Budget view: approved and waiting against the 3,570 USD monthly total and per category limits, sorted by use, with the amount over if everything waiting is approved.
- A cleared queue ends on a summary of what was approved and sent back. Beside the app, each decision appears as the note the teammate would get.
- Restore the sample month from the ledger, the summary or the page.

Keyboard: right arrow approves, left arrow sends back, L moves to later, Z undoes. Focus moves to the heading of each new view, sheets keep focus inside and Escape closes them. State lives in memory only, with no storage, account, backend or payment. Reduced motion turns off the card flight, stamps and sheet slides.

## Design notes

- Type: Schibsted Grotesk for headings and text, IBM Plex Mono for receipt lines, amounts and labels.
- Colors: stone #e7e4dc page, carbon ink #151718, receipt paper #fffefa, ledger green #136148 for approve, stamp red #a8322a for send back, ochre #6f4f00 on #f4e8c6 for policy flags.
- Receipts are square with a torn bottom edge. Buttons are 54 px tall with a 2 px border, and every control is at least 44 px tall on touch screens.
- The phone frame is 404 px wide at most. On a phone the bezel is dropped, the app fills the screen and the tab bar sticks to the bottom.
## Inputs needed for a real refresh

The current screens or source, the target sections and devices, the existing design system, the expected editable format, the known UX problems and the acceptance criteria. Scope is agreed before a fixed quote. The budget band shown on the public listing is the buyer's advertised range, not an agreed price. HTML, CSS and reviewed visual exports are available. Native Figma or Adobe files are only promised once the needed format is confirmed.

Public brief: https://www.workana.com/job/mobile-app-ui-ux-design-enhancement-for-existing-application
