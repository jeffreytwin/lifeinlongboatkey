# Longboat Key Interactive Neighborhoods & Condos Map

## Project goal

Build a production interactive map for **lifeinlongboatkey.com** that lets prospective buyers filter and browse the 108 neighborhoods and condo communities on Longboat Key, FL. Replaces/augments the current static Neighborhoods page.

This is a sibling to the existing Parrish implementation at **lifeatparrish.web.app**, adapted for LBK's unique characteristics:
- ~3.5× the inventory (108 vs ~30)
- Barrier island geography (north / mid / south positioning matters a lot)
- Mixed inventory (77 condo communities + 31 single-family neighborhoods)
- Wider price range ($200K studios → $23M estates)

## Reference assets

Day-one reference material lives in `docs/`:

| File | Purpose |
|---|---|
| `docs/longboat-key-map-mockup.html` | Working HTML prototype. Design spec for pins, filters, card layout, colors, and interaction behavior. |
| `docs/Neighborhoods & Condos.csv` | Source export from the live Wix "Neighborhoods & Condos" collection. Kept for the future Wix-sync script. |
| `docs/KICKOFF_PROMPT.md` | Historical first-session prompt. Kept as a record. |

The production data source is `src/data/communities.json` — 108 enriched records already shaped for the filter logic.

## Architecture decisions (locked)

### Stack
- **Vanilla JS + ES modules** — no framework. Matches actual Parrish conventions (chosen "for performance").
- **Vite 7** — build tool.
- **Tailwind CSS v4** + plain CSS files under `src/assets/css/` — same split Parrish uses (`main`, `sidebar`, `map`, `cards`, `details-panel`, `tablet`, `mobile`).
- **Mapbox GL JS 3** — map engine. Vector tiles, built-in GeoJSON clustering, HTML marker support via `mapboxgl.Marker`. Mockup uses Leaflet; translated to Mapbox to match Parrish.
- **Tile/basemap** — Mapbox style `mapbox://styles/mapbox/light-v11` by default. Style can be swapped without code changes.
- **Firebase Hosting** — deploy target, `lifeinlongboatkey.web.app`. GitHub Actions (`.github/workflows/deploy.yml`) deploys on every push to `main`.
- **Data** — static `src/data/communities.json` for MVP. Live `@wix/data` fetch (Parrish pattern) is a follow-up. CSV source is preserved in `docs/` so future sync work has a reference shape.

### File layout

```
lifeinlongboatkey/
├── .github/workflows/deploy.yml
├── .firebaserc                       (Firebase project: lifeinlongboatkey)
├── firebase.json                     (hosting.public = "dist")
├── .gitignore                        (config.js is gitignored — holds the Mapbox token)
├── .npmrc                            (legacy-peer-deps=true, matches Parrish)
├── vite.config.ts                    (@tailwindcss/vite plugin + manualChunk for mapbox)
├── package.json
├── config.example.js                 (template; copy to config.js and fill in tokens)
├── index.html                        (app shell: header, sidebar, content area)
├── docs/                             (prototype + source CSV)
├── public/
└── src/
    ├── data/
    │   └── communities.json
    └── assets/
        ├── css/  (main, sidebar, map, cards, details-panel, tablet, mobile)
        └── js/
            ├── main.js               (entry; wires modules)
            └── modules/
                ├── data.js           (returns communities array — swappable with live Wix fetch later)
                ├── state.js          (central mutable state object)
                ├── utils.js          (locationLabel, countsBy, escapeHtml)
                ├── matches.js        (filter + sort: matches(), getFiltered(), priceSortValue())
                ├── filters.js        (filter panel render + event wiring)
                ├── list.js           (card grid render + card↔pin sync triggers)
                ├── map.js            (Mapbox init, zone labels, cluster source, HTML markers, popups, flyTo)
                └── details-panel.js  (stub; expands in a future plan)
```

## Filter design (preserved from the mockup — do not reshape without a reason)

1. **Community Type** (pill buttons, front and center) — All / Neighborhoods / Condos
2. **Location on Island** (checkboxes) — North End / Mid-Key / South End
3. **Waterfront** (checkboxes) — Gulf-front / Bay-front / Beach Club Access / Walk to Beach / Off-water
4. **Price** (chip buckets — deliberately NOT a slider) — Under $500K / $500K–$1M / $1M–$2M / $2M–$5M / $5M+
5. **Home Type** (checkboxes) — Condominiums / Single Family Homes / Villas / Townhomes
6. **Bedrooms** (chip selector) — 1 / 2 / 3 / 4 / 5
7. **Amenities** (checkboxes, sorted by frequency)
8. **55+ Community** (toggle)

**Not used:** Garage (too many 0-car condo buildings make it noisy).

## Data model

Each record in `src/data/communities.json` looks like:

```json
{
  "name": "Islander Club",
  "type": "condo",
  "subtitle": "Expansive beachfront residences",
  "shortDescription": "...",
  "priceRange": "$800s - $1M",
  "priceTiers": ["$500K–$1M", "$1M–$2M"],
  "sqft": "1,200 - 2,400",
  "bedrooms": "2 - 3",
  "bedTags": ["2", "3"],
  "homeTypes": ["Condominiums"],
  "amenities": ["Tennis", "Community Pool", "Beach Access"],
  "location": "south",
  "waterfront": ["Gulf-front"],
  "is55plus": false,
  "lat": 27.346483,
  "lng": -82.603849,
  "pageUrl": "/neighborhood/islander-club"
}
```

### Derivation logic (for the future Wix sync)
- **`type`** — CSV column `Condo Community?` (boolean)
- **`location`** — hand-classified by community name. North / Mid / South. QA pass needed.
- **`waterfront`** — derived from CSV amenity yes/no columns:
  - `Private Beach` / `Private Beach (Deeded)` → `Gulf-front`
  - `Marina Access` / `Personal Boat Slips` → `Bay-front`
  - `Beach Club Access` (and none of the above) → `Beach Club Access`
  - `Beach Access` only → `Walk to Beach`
  - None → `Off-water`
- **`priceTiers`** — mapped from CSV `Price Range Tags`
- **`lat`/`lng`** — estimates for MVP. Real geocoding pass is a follow-up.

## Deployment

- **Firebase project:** `lifeinlongboatkey` → `lifeinlongboatkey.web.app`
- **Auto-deploy:** `.github/workflows/deploy.yml` runs on every push to `main`. Requires two GitHub secrets on this repo:
  - `FIREBASE_SERVICE_ACCOUNT` — JSON service-account key (Firebase Console → Project Settings → Service accounts → Generate new private key)
  - `MAPBOX_ACCESS_TOKEN` — public token from mapbox.com
- **Local development:** copy `config.example.js` → `config.js` (gitignored), paste a Mapbox public token, then `npm install && npm run dev`.

## Open decisions (tracked; follow-up plans)

1. **Mobile experience** — MVP has a minimal stack fallback. A real mobile drawer (filter drawer sliding up, map/list toggle, sticky summary) is a separate plan.
2. **Community photos** — not in MVP. The CSV has `wix:image://v1/...` URLs that need resolution; Parrish's sync pattern is the reference.
3. **Real geocoding** — estimated `lat`/`lng` are acceptable for MVP. A Google Places seed + manual QA pass is a follow-up.
4. **Live Wix data fetch** — replace `src/assets/js/modules/data.js` with a `@wix/data` client call, matching Parrish's `api.js`.
5. **Wix-iframe embed** — add `send-url-to-iframe.js` + postMessage listeners when we embed into `/neighborhoods` on the main site.
6. **LBK outline polygon** — optional visual anchor. Can be a hand-drawn GeoJSON or pulled from OSM.

## Coding conventions

- Match Parrish's `src/assets/js/modules/` split — one concern per module.
- Plain ES modules, no framework. Functional modules over classes.
- Token lives in `config.js` (gitignored), loaded as `window.config` from a plain `<script>` tag before the app module.
- CSS is token-driven — all colors in `main.css` `:root { ... }`. Match the mockup's palette unless the brand evolves.
- Never invent data — if a required field is missing, flag it and ask.

## Working with this project

1. Read this file.
2. Open `docs/longboat-key-map-mockup.html` in a browser to see the target UX.
3. Inspect `src/data/communities.json` for the data shape.
4. Ask clarifying questions on open decisions before starting a big change.

When locking in a new decision, move it out of "Open decisions" and into "Architecture decisions."
