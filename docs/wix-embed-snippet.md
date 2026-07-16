# Embedding the map on a Wix location page

Each neighborhood / condo page on **lifeinlongboatkey.com** can embed a
focused version of the interactive map that highlights that one community,
flies to it, and offers a button out to the full map.

It's the *same* app (`map.lifeinlongboatkey.com`) running in **embed mode** —
not a separate build — so the pins, polygons, photos, and data stay in
one place. Anything shipped to the main map is live in every embed on the
next page load.

## How it works

Every embed runs the FULL app experience (filter rail, Map/List toggle,
rich list cards, details panel) with the site header hidden. Two URL
params drive the scoping:

| Param | Value | Effect |
|---|---|---|
| `embed` | `1` | Full-app embed, island-wide, booting into the list view. With `community`, boots on the map focused on that community with its details panel open. |
| `community` | a **slug** | The community to focus + open. (`focus` works as an alias.) |

The details panel is the same as the full app — photos, price/beds/sqft,
amenities, and the Homes for Sale listings. (The panel's "Location on
Longboat Key" reference map is dropped in embeds; the embed's own map is
the location context.) On narrow screens the embed shows a poster that
opens the focused full app in a new tab instead.

The **slug is the last segment of the community's page URL.** For example a
community whose `pageUrl` is `/neighborhood/islander-club` has the slug
`islander-club`. If a slug doesn't match a page URL, a slugified community
name is tried as a fallback.

The CTA opens `map.lifeinlongboatkey.com/?community=<slug>` in a new tab —
the full map, pre-focused on the same community (deep-linking works on the
full map too, with or without `embed`).

## Embed snippet (Wix → Embed → Embed a Widget → Custom Element / iframe)

Use Wix's **HTML iframe (Embed HTML)** element and paste, replacing the slug:

```html
<iframe
  src="https://map.lifeinlongboatkey.com/?embed=1&community=islander-club"
  title="Islander Club on the Longboat Key interactive map"
  style="width:100%; height:480px; border:0; border-radius:12px; overflow:hidden;"
  loading="lazy"
  allowfullscreen
  allow="fullscreen *; picture-in-picture *; autoplay"
  referrerpolicy="no-referrer-when-downgrade">
</iframe>
```

- Swap `islander-club` for the slug of the community whose page you're on.
- `height` is up to you; ~420–520px reads well in a Wix content column.
- A `border-radius` on the iframe matches the site's rounded cards.
- Old snippets pointing at `lifeinlongboatkey.web.app` still work (the app
  redirects, params intact), but new/updated pages should use
  `map.lifeinlongboatkey.com` directly — it skips the redirect hop.

## "See It On The Map" button on the dynamic community pages

The dynamic Neighborhoods & Condos pages can carry a button that jumps to
the full map pre-focused on that community — the map opens with the pin
highlighted, the camera flown to it, and its details panel open. The link
target is:

```
https://map.lifeinlongboatkey.com/?community=<slug>
```

The slug is the last segment of the community page's own URL (the Wix
item slug), so on a dynamic page it can be read straight off the address —
no CMS field or dataset connection needed. In the page code for the
dynamic page template (Dev Mode on):

```js
import wixLocation from 'wix-location';

$w.onReady(function () {
  // Dynamic page URL ends in the item slug, e.g. /neighborhood/aquarius-club
  const path = wixLocation.path;
  const slug = path[path.length - 1];
  $w('#button4').link = `https://map.lifeinlongboatkey.com/?community=${slug}`;
  $w('#button4').target = '_blank'; // '_self' to navigate in place instead
});
```

- Replace `#button4` with the button's actual ID (shown in the floating
  toolbar when the button is selected — right-click → View Properties).
- Leave the button's Link setting in the editor as **None**; the code sets
  it at runtime on every dynamic page from one template.
- A `?community=` arrival counts as fresh intent: it overrides any saved
  session filters, so the community is never filtered out of its own
  deep link. An unknown/stale slug degrades to the plain full map.

## Featured group embed (e.g. Bay Isles)

`?embed=<group-slug>` (e.g. `?embed=bay-isles`) embeds the full
filter/list/details experience scoped to a named cluster of communities.
It **boots into the list view** with detailed cards — beds, sqft, a short
description, amenities, and "View (N) Homes for Sale" / "View Community
Page" buttons — and the map is one toggle away. "View Homes for Sale"
opens the details panel scrolled to that community's listings; "View
Community Page" opens the community's page on the main site in a new tab.

On narrow screens every embed (group and community alike) shows a poster
image instead; tapping it opens the full experience as a top-level page
(`?group=<slug>` for groups, `?community=<slug>` for communities).

Groups are defined in `src/assets/js/modules/embed.js` (`GROUPS`) — adding
a new cluster is a one-line change there.

## Auto-height: the `<lbk-map-embed>` Custom Element (recommended)

A fixed-height iframe forces tall content (a details panel with 12
listings) to scroll inside the frame. The Custom Element wrapper solves
this: the app measures its content and posts
`{ type: 'lbk-embed-height', height }` to the host, and the element
resizes the iframe so the Wix page grows with the content instead.

**Wix setup** (works on premium plans with a connected domain):

1. In the editor: **Add Elements → Embed Code → Custom Element**.
2. In the element's settings choose **Server URL** and enter
   `https://map.lifeinlongboatkey.com/embed-element.js`.
3. Set **Tag name** to `lbk-map-embed`.
4. Under **Set Attributes**, add either
   `group="bay-isles"` (featured group embed) **or**
   `community="islander-club"` (single-community embed).
   Optional: `min-height="480"`, `max-height` override (px).
5. Stretch the element to full section width. Its height is managed at
   runtime — it grows/shrinks as panels open and close (growth is
   instant, shrinking is delayed 0.5s to avoid pumping).

Implementation lives in `public/embed-element.js` (host side) and
`src/assets/js/modules/embed-height.js` (app side). Plain iframe embeds
keep working unchanged — they just stay fixed-height.

## Notes / follow-ups

- All communities still render in the single-community embed for spatial
  context (island-wide filters and list); the embedded one is highlighted,
  focused, and opens with its details panel.
- A future enhancement (Open decision #3) is to drive the slug via
  `postMessage` from the Wix page (`send-url-to-iframe.js`) so the snippet
  doesn't hard-code it — useful if Wix can template the page URL but not the
  iframe `src`.
