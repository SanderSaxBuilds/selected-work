# Inkpost

Four responsive HTML emails for Kettlewick Coffee Roasters, a fictional coffee roaster, and the small Node build that makes them. Kettlewick, its people, its address, the order and every price are sample content made for this portfolio piece. It is not client work and none of these emails was ever sent to anyone. Every email says so in its footer.

Live path once published: https://sandersaxbuilds.github.io/selected-work/email-kit/

**Rendering was checked in Chromium only.** Outlook, Gmail and Apple Mail were not opened. The Outlook code was checked structurally by tests on the built files. It has not been seen in Outlook itself. The limits section below says exactly what that covers.

## The emails

| Email | Built size | What it shows |
| --- | --- | --- |
| Welcome | 19.2 KB | Hero image, a dashed welcome code box, a VML button and three numbered steps built from table cells |
| Order confirmation | 22.7 KB | A real data table of items, quantities and prices, totals that add up, and two columns for the address and the delivery details |
| Shipping update | 21.0 KB | A four step tracker made of table cells, the tracking number, a Track your parcel button and the items in the box |
| Newsletter | 28.8 KB | Hero image, a two by two product grid that stacks to one column on phones, outline buttons and an event box |

Each email also has a plain text version in `dist/` with every link written out in full. The largest file is under a third of the 102 KB where Gmail clips a message.

## What every email handles

- **Outlook on Windows.** Layout is tables only, with widths in attributes. A 600 pixel ghost table holds the fluid container, and ghost cells hold the columns. Buttons are VML roundrects with a styled link for every other client, sharing the same link and label. An Outlook only style block sets the font stacks and exact line heights, and the head sets 96 pixels per inch so images keep their size. There is no flex, grid, float or position anywhere.
- **Phones.** Columns are inline-block divs, 100% wide and capped by a max-width, so they sit side by side when there is room and stack when there is not. That works with no media queries at all. A media query then widens the stacked columns, tightens the padding and makes buttons full width.
- **Dark mode.** The color-scheme and supported-color-schemes meta tags, prefers-color-scheme rules for Apple Mail and other clients that support them, and the same colours repeated with data-ogsc and data-ogsb for Outlook.com. The logo is a cherry badge with its own background and the wordmark is live text, so both read on a light or dark inbox.
- **Access.** Layout tables carry role="presentation" and the order table is a real data table with scoped headers. Each email has lang, a real title, an article landmark, a hidden preheader followed by spacer characters, and alt text on every image. Body copy is 16 pixels and nothing visible is under 14. Every link is at least 44 by 44 pixels and all text meets AA contrast in both modes.
- **Web font.** Headings use Young Serif where the client loads web fonts, inside a block Outlook never sees. Everywhere else they fall back to Georgia, and body text uses Helvetica and Arial.

## How the build works

The source is one shared layout, three partials, four templates, one JSON data file per email and five style sheets. `build.mjs` renders each template into the layout, inlines the CSS and writes the result to `dist/`.

- **Templates.** `lib/template.mjs` is a tiny template language: escaped and raw values, if, unless, each and else blocks, and partials that take arguments. A missing value stops the build with the file and line number.
- **CSS inliner.** `lib/css.mjs` inlines `inline.css` onto each element by specificity and source order, and the element's own style always wins. It accepts only tag, class and tag with class selectors and refuses anything else, so a rule that cannot be inlined fails the build instead of quietly disappearing. It also adds the bgcolor and width attributes Outlook reads.
- **What stays in the head.** `head.css` for resets, client fixes and the phone media query, `dark.css` for dark mode, `font.css` for the web font and `mso.css` for Outlook. None of these is inlined.
- **HTML checks.** `lib/html.mjs` is a small tokenizer and parser. The tests use it to read each built file twice, once as Outlook sees it and once as every other client does, and both views must parse cleanly.
- **Links.** Image and link paths are written as `kit:` paths and the build turns them into absolute https URLs on the published site. Links in the emails lead to `sample-link.html`, which names the link that was followed, so no link is dead.
- **Freshness.** `node build.mjs --check` fails if `dist/` does not match a fresh build.

`node build.mjs` also writes `index.html`, the preview page, from `src/preview/index.html`.

## The preview page

`index.html` shows each email in a frame with a Phone 375 or Desktop 680 width toggle and a Light or Dark toggle. The dark toggle switches the email's own dark mode rules on and off, whatever the system setting is. Each email has a short list of what it handles, its subject and preview text, its built size, a View source button and downloads for the HTML and plain text versions. On a narrow screen the desktop width is scaled down to fit and the page says so.

## Files

| Path | Role |
| --- | --- |
| `build.mjs` | The build. Renders, inlines, writes `dist/`, `dist/manifest.json` and `index.html` |
| `lib/template.mjs`, `lib/css.mjs`, `lib/html.mjs` | Template language, CSS inliner, HTML tokenizer and parser |
| `src/layouts/` | The shared HTML and plain text layout |
| `src/partials/` | Header, footer and the VML button |
| `src/templates/` | The four emails, HTML and plain text |
| `src/data/` | Brand details and the sample content for each email |
| `src/styles/` | `inline.css` is inlined, the other four stay in the head |
| `src/preview/index.html` | Source of the preview page |
| `dist/` | Built emails, plain text versions and the manifest |
| `index.html`, `preview.css`, `preview.js` | The preview page |
| `sample-link.html` | Where every link in the emails leads |
| `art/art.mjs`, `art/*.svg`, `images/` | The illustrations, drawn as SVG and rendered to PNG |
| `tests/lib.test.mjs` | Unit tests for the template language, inliner, parser and text helpers |
| `tests/emails.test.mjs` | Tests on every built email |
| `checks/cdp.mjs` | DevTools Protocol helper copied from Gridline. It removes its own temporary browser profile |
| `checks/intercept.mjs` | Answers requests for the published site from the local files |
| `checks/render.mjs` | Renders each email at 375 and 680 pixels in light and dark mode |
| `checks/preview.mjs` | Checks the preview page at four widths and its controls |
| `checks/cover.mjs`, `checks/cover/` | Builds `cover-email-kit.png` from real screenshots |
| `checks/serve.mjs` | Small static server for the browser checks |
| `shots/` | Screenshots saved by the checks |

## Run it

No install and no dependencies. Node 20 or newer.

```
node build.mjs
node build.mjs --check
node --test tests/lib.test.mjs tests/emails.test.mjs
node checks/serve.mjs . 8934
node checks/render.mjs
node checks/preview.mjs
node checks/cover.mjs
node art/art.mjs
```

Name the test files when running the tests. On Windows, `node --test` with only a folder name does not find them.

The browser checks drive headless Brave from its default Windows path. Set `BRAVE_PATH` to use another Chromium browser. They expect the server above on port 8934 and take another base address as their first argument. The emails point at the published site, so the checks catch those requests and answer them from the local files. Any request for a file that does not exist fails the check.

## Design

The emails use the Kettlewick palette: oat page `#f4ece1`, cream card `#fffdf9`, cherry `#a3213a`, roast ink `#2a1b17` and a blush tint `#f8e3dc`. In dark mode the page turns to `#17110f`, the card to `#221a17` and the cherry text to a soft pink `#f6a5b0` so it keeps its contrast. The illustrations are flat drawings of bags, cups and a pour-over in the same colours.

The preview page has its own look so it does not compete with the emails: lavender paper `#efedf4`, ink `#1c1a26` and magenta `#b0136a`, with Instrument Serif headings, Instrument Sans text and 2 pixel corners.

## Limits

- Rendering was checked in Chromium only. Outlook, Gmail, Apple Mail, Yahoo and Samsung Mail were not opened. The Outlook code was checked by tests on its structure: the conditional comments are balanced, the Outlook view parses, every VML button matches its fallback link, widths are in attributes and no layout CSS that Word ignores is used. That is good evidence the code is written correctly. It is not proof that Outlook draws it as intended.
- The data-ogsc rules for Outlook.com were never run in Outlook.com. Gmail apps ignore prefers-color-scheme and may change colours on their own in dark mode.
- The emails were never sent through an email service, so there is no spam or deliverability testing and no merge tags for a real sending platform. The unsubscribe and preference links go to the sample page.
- The size check measures the built file. A sending platform adds tracking code, which adds bytes, but the largest email still has more than 70 KB of room.
- Images are hosted on GitHub Pages with the rest of the kit. A real send would move them to the sender's own image host.
