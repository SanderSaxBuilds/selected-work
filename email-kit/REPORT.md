# Inkpost report

20 October 2026. Four HTML emails for Kettlewick Coffee Roasters, a fictional coffee roaster, with a plain text version of each, a Node build with no dependencies and a preview page. Kettlewick and every name, address, order and price in the emails are sample content. This is not client work and nothing was sent to anyone.

**Rendering was checked in Chromium only.** Outlook, Gmail and Apple Mail were not opened. The Outlook code was checked structurally: tests read each built file as Outlook would see it and confirm the markup is correct. Nobody has seen these emails in Outlook itself.

## Results

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `node --test tests/lib.test.mjs tests/emails.test.mjs` | 15 of 15 pass |
| Email tests | same run | 83 of 83 pass |
| All Node tests | same run | **98 of 98 pass** |
| Build is fresh | `node build.mjs --check` | Pass, dist is up to date |
| Email renders | `node checks/render.mjs` | **129 of 129 pass** |
| Preview page | `node checks/preview.mjs` | **43 of 43 pass** |
| Cover | `node checks/cover.mjs` | Pass, 1600 by 1000, no console problems |
| Tests catch breakage | three faults put into the built newsletter | 18 tests fail as they should, 98 of 98 pass again after a rebuild |

All browser checks ran in headless Brave, a Chromium browser, through `checks/cdp.mjs` copied from Gridline. Each run removes its own temporary browser profile.

### Built sizes

| Email | HTML | Plain text | Share of Gmail's 102 KB clip |
| --- | --- | --- | --- |
| Welcome | 19,652 bytes | 1,891 bytes | 19% |
| Order confirmation | 23,256 bytes | 2,137 bytes | 23% |
| Shipping update | 21,519 bytes | 1,641 bytes | 21% |
| Newsletter | 29,501 bytes | 2,867 bytes | 29% |

## What the checks cover

### Node tests, 98

The 15 unit tests cover the template language, the CSS inliner, CSS minifying, the HTML parser and its two conditional views, comment cleaning, plain text wrapping and money formatting.

The email tests run 19 checks on each built email. The order also gets a totals check, the order and the newsletter get a hybrid columns check, and four checks cover the whole set:

- The file is under 102 KB and matches the size in the manifest.
- Every element closes in both the Outlook view and the standard view.
- MSO conditional comments are balanced, never nested and closed in the right form.
- Every layout table has role="presentation". The one data table has no role and uses scoped headers.
- Widths are in attributes on every table and every ghost table cell. Anything capped by max-width sits in a fixed width Outlook cell.
- No flex, grid, float or position anywhere.
- Every image has alt text, width and height attributes and an absolute https source.
- Every link is an absolute https URL.
- Each VML button has an HTML fallback with the same link and label.
- No JavaScript and no external CSS.
- The head keeps the media queries, dark mode and Outlook.com rules, and none of the inlined rules.
- No inlined rule is missing from any element it matches.
- Every class is defined in the inline or head styles.
- lang, a real title, the article landmark and a hidden preheader are all present.
- Visible text is at least 14 pixels and body copy 16.
- The plain text version exists and contains every link.
- The copy has no em or en dashes, no ampersands and no parentheses.
- The email says it is a sample from a fictional business.
- On the order, the line totals, discount and total add up as printed.
- On the order and the newsletter, the hybrid columns are inline-block, 100% wide, capped by max-width and wrapped in ghost cells.
- Across the set: the manifest lists the four emails, `dist/` matches a fresh build, every inline rule is used and every head class is used.

To show the tests catch real faults, one role="presentation", one endif and one alt attribute were removed from the built newsletter. 18 tests failed, all on the newsletter or the freshness check. After `node build.mjs` all 98 passed again.

### Email renders, 129

Each of the four emails at 375 and 680 pixels, in light and in dark mode, is 16 renders. Each render gets 8 checks:

- no horizontal overflow
- every image loads
- no visible text under 14 pixels
- every link at least 44 by 44 pixels
- text contrast meets AA, with the lowest ratio 5.24 in light mode and 6.93 in dark
- columns stack at 375 and sit side by side at 680
- the light or dark palette applied
- no console errors

One more check confirms that all 64 requests for published files were answered from files in the kit. A screenshot of each render is in `shots/`.

### Preview page, 43

- At 320, 390, 768 and 1440 pixels: no horizontal overflow, all 15 controls at least 44 by 44, the email frame loads and fits, the right starting width and no console errors.
- The width and mode toggles change the email itself, including its media query and its dark palette.
- Links inside the frame open a new tab.
- Tabs work by click and by arrow keys, Home and End, with one tab stop.
- View source shows the full built file and all 8 downloads resolve.
- A link or hash change to an email opens it.
- A dark system setting starts the page in dark mode, and Light overrides it.
- At 390 the desktop view scales down and says so.
- The sample link page has no overflow at 320 and 1440.

## Bugs found and fixed

- The CSS minifier left a space before a colon in a declaration. Fixed and covered by a unit test.
- The preheader class had no matching head rule. Added a rule that hides it for any client that drops inline styles.
- A link to an email on an already open preview page did nothing, because a hash change does not reload the page. Added a hash change handler.
- At 375 pixels the shipping tracker dates and the order discount label wrapped onto two lines. Shortened both to fit.
- One broken build file stopped the whole email test file from loading. Each test now parses on first use, so a fault fails only the tests it affects.
- The 14 pixel check counted zero size spacing cells, and the plain text check missed a phrase that wraps across lines. Both checks were corrected, not loosened.
- The render check failed once on the browser's own favicon request, which no email makes. That one request is now ignored.

## Not verified

- Outlook, Gmail, Apple Mail, Yahoo and Samsung Mail were not opened. The Outlook code was checked on its structure only. That shows it is written correctly, not that Outlook draws it as intended.
- The Outlook.com dark mode rules were never run in Outlook.com. Gmail apps ignore prefers-color-scheme and may change colours on their own.
- Nothing was sent through an email service, so there is no deliverability or spam testing and no merge tags for a real platform.
- The size check measures the built file. A sending platform adds tracking code, though the largest email has more than 70 KB of room.
- The web font loads only where a client allows web fonts. Everywhere else the headings use Georgia.
