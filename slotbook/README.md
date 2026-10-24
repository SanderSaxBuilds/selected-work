# Slotbook

A sample appointment booking page for Lamyai Cycle Workshop, a fictional bike repair workshop in Chiang Mai. The business, its address, prices and every booking are sample data. It is not client work and nothing is sent anywhere.

Live path once published: https://sandersaxbuilds.github.io/selected-work/slotbook/

## What it does

- **Services.** Four services from 30 to 180 minutes, each with its own length.
- **Opening rules.** Weekly hours with a lunch break, a closed weekday, and date overrides that close a day, replace its hours or add extra hours. The sample overrides are placed relative to today so they always show.
- **Slot rules.** Slots start every 30 minutes, need 3 hours of notice, stop 28 days ahead and keep a 15 minute buffer either side of every booking. A slot never crosses a break or closing time.
- **Time zones.** The workshop runs on Asia/Bangkok. A visitor can show times in London, New York, Sydney or their own device zone. Days in the calendar are the visitor's days, each time also shows the workshop time, and a note names any clock change inside the booking window. All zone maths uses `Intl.DateTimeFormat`, with no date library.
- **Day picker.** An ARIA grid with one roving tab stop. Arrow keys move by day and week, Home and End go to the start and end of the week, Page Up and Page Down change month, Shift with Page Up or Page Down changes year, and Enter or Space picks the day. Movement is clamped to the booking window.
- **Day timeline.** Open times sit on a vertical day timeline like a calendar app. Hovering or focusing a start time shows a ghost block as long as the service, booked time shows as grey blocks, and the picked time becomes a solid block that can be dragged up or down to any other free start.
- **Booking.** A details form with inline errors, an error summary that takes focus and links to each field, and a recheck that the slot is still free before saving.
- **Calendar file.** The confirmation offers an `.ics` download that follows RFC 5545: CRLF line endings, lines folded at 75 octets without splitting a UTF-8 character, UTC `DTSTART` and `DTEND`, a `UID`, a `DTSTAMP` and escaped text.
- **Storage.** Bookings and the chosen zone are saved in `localStorage`. Every read and write is wrapped in try and catch, so the page still works when storage is blocked.
- **Workshop diary.** A week view with one column per day, closed time shaded and a line for now. Staff drag a booking to another time or day, or focus it and use the arrow keys, then Enter to place it and Escape to put it back. The move goes through `rescheduleBooking` in the core, so it follows the same buffer, notice and opening rules as a new booking, and a toast offers Undo. The day list beside it cancels a booking after a second confirming press. A cancelled time is bookable again straight away.
- **Access.** 44 pixel tap targets, a 3 pixel focus ring, no horizontal scrolling from 320 pixels up, and no transitions when the visitor asks for reduced motion.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `styles.css` | The page and its styles |
| `src/core.mjs` | Pure logic: zones, opening rules, slots, validation, bookings, month grid, key movement, iCalendar |
| `src/data.mjs` | The fictional workshop, its services, hours, sample overrides and seeded bookings |
| `src/app.mjs` | Rendering, events and storage |
| `tests/core.test.mjs` | Unit tests for the core and sample data |
| `checks/cdp.mjs` | DevTools Protocol helper copied from Gridline. It removes its own temporary browser profile |
| `checks/flow.mjs` | End to end browser check |
| `checks/shots.mjs` | Screenshots and the overflow check at four widths |
| `checks/cover.mjs`, `checks/cover/` | Builds `cover-slotbook.png` from a real phone screenshot |
| `checks/serve.mjs` | Small static server for local checks |

## Run it

No install and no build. Node 20 or newer with full ICU.

```
node checks/serve.mjs . 8932
node --test tests/core.test.mjs
node checks/flow.mjs
node checks/shots.mjs
node checks/cover.mjs
```

The browser checks drive headless Brave from its default Windows path. Set `BRAVE_PATH` to use another Chromium browser.

Adding `?now=2026-10-20T03:00:00Z` to the page address fixes the page clock. The checks and the cover use it so the London change on 25 October and the New York change on 1 November fall inside the booking window.

## Design

A calendar app a workshop opens every morning. White sheets on a cool stone canvas `#eff1ed`, ink `#15171a` for controls, and one colour per service, blue for punctures, green for tune ups, violet for fits and rose for overhauls, so a day reads at a glance. Geist for text and Geist Mono for times and figures. The confirmation prints out as a ticket stub with a tear line.

## Limits

- The workshop zone has no clock changes. The core handles a zone that does: a skipped time is left out and a repeated time is offered once, at its first occurrence. Unit tests cover both with a London workshop.
- Bookings live in one browser. Two tabs open at once do not see each other's new bookings until reload.
- One bench, so one booking at a time. There is no capacity per slot.
