# Slotbook verification report

20 October 2026. Everything below ran on the development PC against the files in this folder, served locally at http://127.0.0.1:8932/ with Node 24.19.0 and headless Brave.

## Results

| Acceptance item | Command | Actual result |
| --- | --- | --- |
| Unit tests pass | `node --test tests/core.test.mjs` | 34 of 34 pass |
| Browser flow passes | `node checks/flow.mjs` | 97 of 97 checks pass, saved in `checks/flow-results.json` |
| No overflow at 320, 390, 768 and 1440 | `node checks/shots.mjs` | scrollWidth equals clientWidth in three states at all four widths, and no element sticks out. 12 screenshots in `shots/` |
| No console errors | flow, shots and cover scripts | No console errors, uncaught exceptions or failed requests |
| Cover image | `node checks/cover.mjs` | `cover-slotbook.png`, 1600 by 1000, one real phone screenshot at 2x on the oxblood brand colour |

## What the unit tests cover

- Calendar date helpers, month clamping and leap years.
- Bangkok wall time to UTC, and offset labels including UTC+5:30.
- London offsets either side of 29 March and 25 October 2026. A London time skipped in March returns null and a time repeated in October returns its first occurrence.
- Clock change detection for London, New York and Bangkok across the booking window.
- Weekly hours, merging, and overrides that close a day, replace its hours or add extra hours, including extra hours that bridge a lunch break.
- Slot generation on the step, never across a break, long services that only fit one window, minimum notice and the last bookable day.
- Buffers of 0, 15, 30 and 31 minutes around a booking, and a cancelled booking giving its slot back.
- A London visitor across the late March and late October changes: the same 09:00 workshop slot reads 02:00 then 03:00 in March, and 03:00 then 02:00 in October.
- A New York visitor: workshop mornings land on the previous New York evening, before and after 1 November, and every slot falls on exactly one display date.
- A workshop zone with its own clock changes: no skipped time is offered and no repeated time is offered twice.
- Details validation, booking creation that refuses a taken, off grid or invalid request, cancellation, per day lists and cleaning of stored data.
- The Monday first month grid and every calendar key with clamping.
- iCalendar: CRLF only, a trailing CRLF, 75 octet folding including Thai text, a round trip through unfolding, UTC DTSTART, DTEND and DTSTAMP, UID, escaping, and exact fold lengths at 75, 76 and 150 characters.
- Sample overrides land on the right weekdays, and seeded bookings respect the buffer and are removed from availability.

## What the browser flow covers

With the page clock fixed at Tuesday 20 October 2026, 10:00 in Chiang Mai:

- First load seeds four sample bookings, marks today, disables past days and Mondays, and labels the closed override day with its reason.
- Keyboard calendar: one roving tab stop, arrows, Home, End, Page Up and Page Down, moving across months, clamping at today and at the last bookable day, Enter and Space to select, focus kept on the day, and the live region announcement.
- Seeded bookings and their buffers are missing from the slot list. A closed day explains itself and its button jumps to the next open day, where the late opening adds evening times.
- London: the note names 25 October, Saturday 24 shows workshop 09:00 as 03:00 and Tuesday 27 shows it as 02:00. New York: the note names 1 November, and workshop Tuesday 09:00 shows as 22:00 on Monday 26 October and as 21:00 on Monday 2 November.
- Booking: service change, slot pick with focus moving to the form, an empty submit with four errors and focus on the summary, an error link that focuses its field, a bad email refused, then confirmation with focus on its heading.
- The downloaded .ics is fetched from its blob link and checked for its file name, CRLF endings, 75 octet lines, UTC times matching the booking, UID and escaping.
- The booking is in localStorage, its time and the 15 minute buffer are gone at once and after a reload, and the next free time is offered.
- Staff view: tab switching by arrow key, opening on the next day with bookings, stepping days, the opening hours line, cancel with a Keep option and a confirm step, the cancel saved to storage, the time bookable again, and reset of the sample data.
- A 3 pixel focus ring on keyboard focus, every visible control at least 44 by 44 pixels and no overflow at 320, 390, 768 and 1440, and no transitions under reduced motion.
- A second browser tab where reading localStorage throws: the page loads and a booking still completes with no console errors.

## Bug found during verification and fixed

The details form scrolled into view smoothly, so a click fired straight after picking a time could land while the page was still moving. The flow now waits for the scroll to finish, and under reduced motion the scroll is instant.

## Not verified or not done

- Only Chromium through headless Brave was tested. Firefox, Safari, real phones, touch input and screen readers were not tried. ARIA roles and labels are checked structurally only.
- The .ics file was checked against the RFC rules in code. It was not imported into Google Calendar, Outlook or Apple Calendar by hand.
- Google Fonts load from the network. Without them the page falls back to system fonts.
