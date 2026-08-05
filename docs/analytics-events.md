# GA4 custom events — reference & console setup

The map ships a custom GA4 event layer (`src/assets/js/modules/analytics.js`)
on top of the base Google tag in `index.html`. Events fire only on user
interaction, ride the already-loaded gtag library, and are no-ops on local
dev and the redirecting Firebase hostnames (the library only arms on
`map.lifeinlongboatkey.com` — embeds included, since their iframes load from
that host).

## Context params (attached to every event)

| Param | Values | Meaning |
|---|---|---|
| `app_surface` | `full` \| `embed_group` \| `embed_community` \| `embed` \| `embed_poster` | Which surface the visitor is on — the standalone map or one of the Wix embeds |
| `result_count` | number | Communities matching the filters at the moment the event fired |

## Events

### Journey / conversion

| Event | Params | Fires when |
|---|---|---|
| `community_view` | `community_name`, `community_type`, `island_zone`, `select_source` | The visitor opens a community — `select_source` is `pin`, `polygon`, `preview_card` (mobile two-tap card), `list`, or `deep_link` (a "See It On The Map" arrival). History back/forward restores and the community embed's automatic panel-open do **not** fire it. |
| `listing_click` | community params + `listing_price` | Click-through from a listing card to the home's page on www — the money event. |
| `community_page_click` | community params | "View Community Page" CTA in the details panel. |
| `poster_click` | `poster_target` | Mobile embed poster tap ("Find your home in …"). |

### Filters / "stuck" signals

| Event | Params | Fires when |
|---|---|---|
| `filter_change` | `filter_group`, `filter_value`, `filter_action` (`add`/`remove`/`select`/`toggle`) | Any filter control changes. Groups: `community_type`, `price`, `for_sale`, `home_type`, `bedrooms`, `amenity`, `island_zone`, `waterfront`, `group` (scope-chip ✕). `result_count` already reflects the change. |
| `zero_results` | `active_filters` (compact summary, e.g. `type:condo\|price:$15M+\|beds:5`) | The result count transitions to 0 — the clearest dead-end signal. Fires once per transition, not per render. |
| `clear_all` | — | Clear All / Clear Criteria pressed. Right after a `zero_results` = classic frustration reset. |

### Map & panel engagement

| Event | Params | Fires when |
|---|---|---|
| `zone_click` | `island_zone` | A North End / Mid-Key / South End bubble is clicked. |
| `basemap_toggle` | `basemap` (`map`/`satellite`) | The visitor switches basemap (actual switches only). |
| `locate_on_map` | community params | The reference map in the details panel is clicked. |
| `gallery_interaction` | community params + `gallery_action` (`arrow`/`dot`/`swipe`/`lightbox`) | First photo interaction per panel open — "did they browse photos", not one event per click. |
| `listings_toggle` | community params + `listings_expanded` | "Show all homes" / "matching only" toggle in the listings section. |

### Mobile UX

| Event | Params | Fires when |
|---|---|---|
| `filter_drawer_open` | — | "Narrow it down" drawer opened. |
| `filter_drawer_save` | — | Save pressed (jumps to list; `result_count` = what they saved). |
| `view_toggle` | `view_mode` (`map`/`list`) | The Map \| List segmented control — user taps only, programmatic switches are silent. |

## One-time GA4 console setup

Custom params are invisible in reports until registered (do this once;
data collected before registration only shows up in Explorations):

1. **Admin → Data display → Custom definitions → Create custom dimension**
   (all Event-scoped): `app_surface`, `select_source`, `community_name`,
   `community_type`, `island_zone`, `filter_group`, `filter_value`,
   `filter_action`, `active_filters`, `view_mode`, `gallery_action`.
   Optionally `result_count` as a **custom metric** instead of a dimension.
   (Free-tier cap is 50 event-scoped dimensions — this uses ~11.)
2. **Admin → Data display → Key events**: mark `listing_click` and
   `community_page_click` as key events (conversions).
3. **Explore → Funnel exploration** — the "getting stuck" dashboard:
   `page_view → filter_change → community_view → listing_click`, broken
   down by `app_surface`. Add a second tab: `zero_results` by
   `active_filters` (table) to see exactly which combos dead-end.

Note the property is shared with www.lifeinlongboatkey.com — all event
names here are map-specific, so they can't collide with Wix's events, and
`app_surface` cleanly separates map traffic in any report.
