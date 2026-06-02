# Embedding the map on a Wix location page

Each neighborhood / condo page on **lifeinlongboatkey.com** can embed a
focused version of the interactive map that highlights that one community,
flies to it, and offers a button out to the full map.

It's the *same* app (`lifeinlongboatkey.web.app`) running in **embed mode** —
not a separate build — so the pins, polygons, photos, and data stay in
one place.

## How it works

Two URL params drive it:

| Param | Value | Effect |
|---|---|---|
| `embed` | `1` | Collapses the header, filter rail, list, and detail panel so the map fills the iframe. Shows the "Explore all neighborhoods on the full map →" CTA. |
| `community` | a **slug** | The community to highlight + fly to. (`focus` works as an alias.) |

The **slug is the last segment of the community's page URL.** For example a
community whose `pageUrl` is `/neighborhood/islander-club` has the slug
`islander-club`. If a slug doesn't match a page URL, a slugified community
name is tried as a fallback.

The CTA opens `lifeinlongboatkey.web.app/?community=<slug>` in a new tab —
the full map, pre-focused on the same community (deep-linking works on the
full map too, with or without `embed`).

## Embed snippet (Wix → Embed → Embed a Widget → Custom Element / iframe)

Use Wix's **HTML iframe (Embed HTML)** element and paste, replacing the slug:

```html
<iframe
  src="https://lifeinlongboatkey.web.app/?embed=1&community=islander-club"
  title="Islander Club on the Longboat Key interactive map"
  style="width:100%; height:480px; border:0; border-radius:12px; overflow:hidden;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade">
</iframe>
```

- Swap `islander-club` for the slug of the community whose page you're on.
- `height` is up to you; ~420–520px reads well in a Wix content column.
- A `border-radius` on the iframe matches the site's rounded cards.

## Notes / follow-ups

- All 107 communities still render in the embed for spatial context; the
  embedded one is highlighted and the map opens zoomed in on it.
- A future enhancement (Open decision #3) is to drive the slug via
  `postMessage` from the Wix page (`send-url-to-iframe.js`) so the snippet
  doesn't hard-code it — useful if Wix can template the page URL but not the
  iframe `src`.
