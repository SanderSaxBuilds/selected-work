# Gridline verification report

19 October 2026. Everything below was run on the development PC against the files in this folder, served locally at http://127.0.0.1:8931/. Nothing was committed, pushed or published.

## Results

| Acceptance item | Command | Actual result |
| --- | --- | --- |
| Unit tests pass | `node --test tests/*.test.mjs` | 54 of 54 pass, 39 for the core and 15 for the edit model |
| Flow check passes | `node checks/flow.mjs` | 128 of 128 checks pass, saved in `checks/flow-results.json` |
| No overflow at 320, 390, 768 and 1440 | `node checks/shots.mjs` | scrollWidth equals clientWidth at all four widths, no element sticks out of the page, screenshots in `shots/` |
| No console errors | flow and shots scripts | No console errors, uncaught exceptions or failed requests in the app at any step |
| Cover image | `node checks/cover.mjs` | `cover-gridline.png`, 1600 by 1000, built from real screenshots of the app |

The flow check covers edit, invalid edit, undo, redo, each filter kind, sort with one and two keys, search, chips, paste with a skipped cell, one value pasted over a range, fill down, copy, CSV export of the view and of the changes, CSV import with the error report, the review panel with single and full revert, pin, hide, resize, reorder, saved views across a reload, keyboard navigation through the ARIA grid, mouse drag selection, Shift and click, double-click editing, and the phone cards with their editor, filters and sort. Filter counts are checked against counts computed separately from a fresh copy of the data.

## Performance

Headless Brave at 1440 by 900 with the GPU disabled, and `node checks/bench.mjs` in Node 24.

- Scrolling 180 pixels per frame for 3 seconds: 60.7 frames per second, slowest frame 16.8 ms, 41 row elements in the DOM.
- Search across 20,000 rows, Enter to next painted frame: 16.9 to 22.4 ms over five runs.
- Sort 20,000 rows by Total, click to next painted frame: 14.3 to 15.0 ms over five runs.
- In Node: generate 20,000 rows in 26 ms, sort by two keys in 6.8 ms, validate and apply 20,000 cell edits in 11.7 ms, undo them in 6.5 ms, write a 3.1 MB CSV in 26.5 ms and parse it in 31.1 ms.

Raw numbers are in `checks/perf-results.json` and `checks/bench-results.json`.

## Bugs found during verification and fixed

1. Ctrl+Home moved to the pinned PO number column but left the grid scrolled to the far right, so the next header click hit the wrong column. Moving into a pinned column from another column now resets the sideways scroll. A flow check covers it.
2. The phone order editor threw on Save because form.elements['item'] returns the collection's built-in item method instead of the Item field. Fields are now looked up by id.
3. A double click on a cell did not open the editor, because the pointer handler cancels the default action to keep drag selection clean. Double clicks are now detected in the pointer handler.
4. The empty state, the toast and the filter badge showed even when hidden, because their display rules overrode the hidden attribute.
5. Changing a filter inside a column menu scrolled the grid to the top and the scroll handler closed the menu. Menus now close only on sideways scrolling.
6. Status and priority sorted alphabetically. They now sort in workflow order, with a unit test.
7. At 320 pixels the fixed-height layout left room for about one and a half cards. Phones now scroll the page, with a sticky footer for the count and order value.

## Not verified or not done

- System clipboard. Headless Brave does not deliver Ctrl+C, Ctrl+V or Ctrl+X key events through the DevTools Protocol. The flow sends those shortcuts as in-page keyboard events and drives the copy and paste handlers with ClipboardEvents. The PC's real clipboard was not touched. Copying to and from Excel or Google Sheets has not been tried by hand.
- Only Chromium through headless Brave was tested. Firefox, Safari, real phones, touch input and screen readers were not tested. ARIA attributes are checked structurally only.
- All timings come from one development PC. Headless frame timing follows a 60 Hz clock, so the scroll result says nothing about a low-end phone.
- Columns are not virtualized. Row insert and delete are not supported.
- The hub, repos/ and other folders were not touched. Not deployed to GitHub Pages.
- The scratchpad shot.mjs was not used because it does not remove its temporary browser profile. checks/shots.mjs does the same overflow check and removes its own profile. No gridline-cdp- profiles were left in the temp folder.
