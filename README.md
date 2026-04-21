# Life in Longboat Key — Interactive Map

Production interactive map for **lifeinlongboatkey.com**. Lets prospective buyers filter and browse the 108 neighborhoods and condo communities on Longboat Key, FL. Sibling implementation to [lifeatparish](https://github.com/jeffreytwin/lifeatparish).

Live (after first deploy): https://lifeinlongboatkey.web.app

## Stack

- Vanilla JS (ES modules) + Vite 7
- Mapbox GL JS 3
- Tailwind CSS v4 (+ plain CSS files per concern)
- Firebase Hosting (auto-deploy via GitHub Actions)

See [CLAUDE.md](./CLAUDE.md) for the full architecture, filter design, data model, and deferred decisions.

## Local development

```bash
# One-time setup
cp config.example.js public/config.js
# edit public/config.js and paste your Mapbox public token

npm install
npm run dev
```

`public/config.js` is gitignored and served at `/config.js` by both the dev server and Firebase Hosting.

Open the URL Vite prints (default `http://localhost:5173`).

If you don't have a Mapbox token yet, the filter panel and card list still work — only the map itself is disabled. Get a free token at [mapbox.com](https://mapbox.com) (free tier covers 50K loads/mo).

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # serves the built bundle locally
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and deploys to Firebase Hosting.

Required GitHub secrets on this repo:

| Secret | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service-account JSON (Firebase Console → Project Settings → Service accounts → Generate new private key) |
| `MAPBOX_ACCESS_TOKEN` | Mapbox public token, baked into `config.js` at build time |

Target Firebase project: `lifeinlongboatkey`.

## Project layout

```
src/
├── data/communities.json       # 108 enriched records — MVP data source
└── assets/
    ├── css/                    # main, sidebar, map, cards, details-panel, tablet, mobile
    └── js/
        ├── main.js             # entry; wires modules
        └── modules/
            ├── data.js         # static loader (to be replaced with live Wix fetch)
            ├── state.js        # central filter state
            ├── utils.js        # labels, count helpers, HTML escape
            ├── matches.js      # filter + sort logic
            ├── filters.js      # filter panel render + events
            ├── list.js         # card grid render + card↔pin sync
            ├── map.js          # Mapbox init, clustering, pins, popup, flyTo
            └── details-panel.js # stub for future detail panel

docs/
├── longboat-key-map-mockup.html   # original working prototype (design reference)
├── Neighborhoods & Condos.csv     # source Wix collection export (for future sync)
└── KICKOFF_PROMPT.md              # historical first-session prompt
```

## Status

- [x] **M1** — scaffold + filter panel + card list against `communities.json`
- [x] **M2** — Mapbox GL map with clustering, popups, card↔pin sync, zone labels
- [ ] **M3** — first Firebase deploy (requires Firebase project + secrets)
- [ ] Follow-ups: mobile drawer, real geocoding, community photos, live Wix fetch, Wix iframe embed
