Hemline, responsive interaction example, revision 3

Open index.html in a browser. The HTML, CSS and interaction source are editable. jQuery 4.0.0 is included locally, so no script CDN is needed. Familjen Grotesk and DM Mono load from Google Fonts when online, and the page falls back to system fonts offline.

Hemline is a fictional two-person alterations counter. The page shows:
- a header that folds into a menu on phones, closes with Escape, a tap outside or a link, and counts the jobs on the ticket.
- a price list by garment that becomes an accordion on phones, where every price adds itself to the ticket.
- a ticket builder: pick a garment and a job, set how much to shorten on a tape-measure slider, and watch the tag add the line, the total and the ready day, counted in working days from today with Sunday closed.
- express pricing, plus half and ready the next working day, switched off when a lining job is on the ticket.
- booking with inline errors and an error summary, a short loading state and a booked stamp with a sample ticket number.

Nothing is sent or saved. The ticket lives only in the open tab. It is an independent demonstration, not paid client work.

Original example source is shared for application review. The separately included jQuery library is distributed under the MIT license, see jquery-LICENSE.txt.

This example does not establish native Photoshop or InDesign editing, PHP, a backend service, a production migration or years of specialist experience.