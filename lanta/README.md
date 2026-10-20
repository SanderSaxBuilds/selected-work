# Lanta

Lanta is a reusable website kit and a browser studio for local businesses in Thailand: spas, tour desks, bike rentals, clinics and cafes. It produces a fast one page site with services in baht, opening hours, a booking widget and an address block, in English, Russian and Thai. Booking requests open in the business's own WhatsApp, LINE or Telegram, so there is no backend, no database and no monthly fee.

Lanta is personal freelance work by Alexandr Khrustalev.

- Studio: https://sandersaxbuilds.github.io/selected-work/lanta/
- Kit demo with a sample business: https://sandersaxbuilds.github.io/selected-work/lanta/kit/site.html

All businesses, prices and contacts in the presets and the demo are samples.

## What is in this folder

| Path | Purpose |
| --- | --- |
| index.html, studio.css, studio.js | The studio app. |
| kit/site.html | Page shell of the generated site. Becomes index.html in the download. |
| kit/site.css | Styles. Accent colour and light or dark theme come from config. |
| kit/site.js | Renders the whole page from config, runs the booking widget, writes search data. |
| kit/config.js | Sample config. The only file a client edits. |
| worker/telegram-relay.js | Optional Cloudflare Worker. Not deployed. The kit works without it. |

No build step, no npm packages and no external scripts. The only outside request is Google Fonts.

## Using the studio

1. Open the studio. The spa sample loads first.
2. Pick a type of business. It fills in sample services, questions, hours and colours. Undo is in the toast.
3. Fill in the name, headline and sub line. The bar above the cards sets which language you are editing. Fields left empty show the English text, and the checklist at the top counts what is still untranslated.
4. Choose an accent colour or a custom one, a light or dark theme and the site languages.
5. Edit services with name, minutes and price. Use 0 for free and 1440 minutes for a day rental.
6. Set weekly hours and the time slot length. The widget only offers start times where the service ends before closing.
7. Pick the booking channel and enter the handle. The studio shows the exact link the site will open.
8. Add the address, area and a Google Maps share link, then the questions.
9. Watch the preview on the right in Desktop or Phone size. On a phone, switch between Edit and Preview with the tabs.
10. Press Download site. The zip holds index.html, site.css, site.js, config.js and a README.md written for that business. Copy config puts config.js on the clipboard instead.

The draft is saved in the browser on this device, so a reload keeps your work. Start over at the bottom of the panel brings back the spa sample.

## How booking works

The visitor picks a service, one of the next seven days and a start time. Times follow the Thailand time zone, whatever the visitor's own clock says, and today's times that are too soon are hidden. The site writes a short message with the service, date, time and optional name and comment, then:

- WhatsApp: opens https://wa.me/NUMBER?text= with the message filled in.
- LINE: opens https://line.me/R/oaMessage/@ID/? with the message filled in for the Official Account.
- Telegram: copies the message to the clipboard first and says so, then opens https://t.me/USERNAME. Telegram cannot prefill a message in a chat with a person.

The page states plainly that this is a request and that the business confirms it in the chat. The kit shows no ratings, reviews, client logos or live availability, because it has none.

## Editing config.js by hand

window.LANTA is plain JSON inside a script. Text fields take a single string or an object with en, ru and th. An empty language falls back to English.

| Field | Meaning |
| --- | --- |
| type | spa, tours, bike, dental, cafe or other. Sets the label and the schema.org type. |
| sample | true shows a sample banner. Set false for a real client. |
| name, tagline, sub | Business name, the large headline and the line under it. |
| accent | Any #rrggbb colour. Button text turns dark or light by itself for contrast. |
| theme | light or dark. Light is the default. |
| languages, defaultLang | Languages in the switch, and the one used for search data and as a fallback. |
| timezone | Asia/Bangkok unless the business is elsewhere. |
| slotMinutes | Distance between offered start times. |
| leadMinutes | How soon a time today can start. 30 hides anything in the next half hour. |
| services | List of name, minutes and price in whole baht. |
| hours | mon to sun, each ["10:00", "21:00"] or null for a day off. "00:00" as closing time means midnight. |
| contact | channel is whatsapp, line or telegram. handle is 66812345678, @yourshop or a username. phone is optional. |
| address | text, city, region, postalCode and mapsUrl. |
| faq | List of q and a. |
| relayUrl | Optional. URL of the Telegram relay below. Leave it out to keep the site fully static. |

A Thai mobile number written with a leading 0 is converted to 66 automatically. If the page goes blank after an edit, a comma or a quote is usually missing. The browser console names the line.

## Hosting

The site is static, so any host works. Two quick options:

- Netlify Drop: open app.netlify.com/drop and drag the unzipped folder onto the page. A live link appears in a few seconds. Connect a domain in the site settings.
- GitHub Pages: create a repository, upload the five files to the main branch, then in Settings, Pages choose Deploy from a branch and the root folder. The site appears at USER.github.io/REPOSITORY.

Search data in schema.org LocalBusiness format is written into index.html at download time and refreshed by site.js on every load, so a later edit of config.js stays in sync.

## Optional Telegram relay

worker/telegram-relay.js is a small Cloudflare Worker for owners who also want a copy of every request in one Telegram chat, for example a staff group. It is optional, it is not deployed anywhere, and the kit works the same without it.

What it does: accepts a JSON POST from the allowed site origins only, checks the fields and their lengths, ignores bots that fill a hidden field, and sends one message to the chat through the Telegram Bot API. The bot token and chat id live in Worker secrets, never in the site.

Setup:

1. Create a bot with @BotFather and add it to the chat that should receive requests.
2. Deploy the file with Wrangler, then add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as secrets and ALLOWED_ORIGINS as a plain variable. The commands are at the top of the file.
3. Put the Worker URL in config.js as relayUrl.

For a busy site, add a Cloudflare rate limiting rule on the Worker route.

## Checks

The studio and the kit were checked headless at 320, 390, 768 and 1440 pixels wide for horizontal overflow and console errors, together with live preview updates, preset switching, all language toggles and a zip that Python's zipfile opens and tests clean.
