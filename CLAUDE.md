# Longboat Key Interactive Neighborhoods & Condos Map

## Project goal

Build a production interactive map for **lifeinlongboatkey.com** that lets prospective buyers filter and browse the 108 neighborhoods and condo communities on Longboat Key, FL. Replaces/augments the current static Neighborhoods page.

This is a sibling to the existing Parrish implementation at **lifeatparrish.web.app**, adapted for LBK's unique characteristics:
- ~3.5× the inventory (108 vs ~30)
- Barrier island geography (north / mid / south positioning matters a lot)
- Mixed inventory (77 condo communities + 31 single-family neighborhoods)
- Wider price range ($200K studios → $23M estates)

## Reference assets in this folder

| File | Purpose |
|---|---|
| `longboat-key-map-mockup.html` | Working HTML prototype. Open it, click around, inspect the code. This IS the design spec for the production build. |
| `communities.json` | 108 enriched community records. Each already has derived fields (`location`, `waterfront`, `priceTiers`, estimated `lat`/`lng`). Use as starting data source. |
| `KICKOFF_PROMPT.md` | The first message to paste into a fresh Claude Code session. |

## Architecture decisions (already made)

### Stack
- **React** — functional components with hooks, matching Parrish repo structure
- **Leaflet.js** + `leaflet.markercluster` — map engine
- **Tile provider** — OpenStreetMap for launch (free, no key), migrate to Mapbox or Google Maps post-launch if premium look is desired
- **Firebase Hosting** — deploy pipeline, matching Parrish
- **Data** — static JSON generated from Wix CMS via sync script (same pattern Parrish uses). Data regenerates nightly.

### Approach
**Fork the existing Parrish codebase.** Most infrastructure (filter state, Firebase deploy, Wix sync, map shell) is reusable. Do not build from scratch.

## Filter design (critical — these are the LBK-specific choices)

The mockup implements the following filter set. Preserve this structure; it was chosen deliberately based on how LBK buyers shop:

1. **Community Type** (pill buttons, front and center — this is the first decision buyers make)
   - All / Neighborhoods / Condo Communities
2. **Location on Island** (checkboxes)
   - North End / Mid-Key / South End (LBK Club & Bay Isles)
3. **Waterfront** (checkboxes)
   - Gulf-front / Bay-front (Marina) / Beach Club Access / Walk to Beach / Off-water
4. **Price** (chip buckets — NOT a linear slider; LBK's $200K–$23M range breaks sliders)
   - Under $500K / $500K–$1M / $1M–$2M / $2M–$5M / $5M+
5. **Home Type** (checkboxes) — Condominiums / Single Family Homes / Villas / Townhomes
6. **Bedrooms** (chip selector) — 1 / 2 / 3 / 4 / 5
7. **Amenities** (checkboxes, sorted by frequency)
8. **55+ Community** (toggle)

**Filters NOT used from Parrish:** Garage (too many 0-car condo buildings make this noisy).

## Data model

Each community record in `communities.json` looks like:

```json
{
  "name": "Islander Club",
  "type": "condo",                           // "condo" | "neighborhood"
  "subtitle": "Expansive beachfront residences",
  "shortDescription": "...",
  "priceRange": "$800s - $1M",              // display string
  "priceTiers": ["$500K–$1M", "$1M–$2M"],   // filter buckets
  "sqft": "1,200 - 2,400",
  "bedrooms": "2 - 3",
  "bedTags": ["2", "3"],
  "homeTypes": ["Condominiums"],
  "amenities": ["Tennis", "Community Pool", "Free Maintenance", "Beach Access", "Fitness Center"],
  "location": "south",                       // "north" | "mid" | "south"
  "waterfront": ["Gulf-front"],              // one or more tags
  "is55plus": false,
  "lat": 27.346483,
  "lng": -82.603849,
  "pageUrl": "/neighborhood/islander-club-(longboat-key-club)"
}
```

### Derivation logic (for regenerating from Wix CSV)
- **`type`** — CSV column `Condo Community?` (boolean)
- **`location`** — hand-classified by community name. North/Mid/South. Needs QA — see Open Decisions.
- **`waterfront`** — derived from CSV amenity yes/no columns:
  - Has `Private Beach` or `Private Beach (Deeded)` → `Gulf-front`
  - Has `Marina Access` or `Personal Boat Slips` → `Bay-front`
  - Has `Beach Club Access` but not the above → `Beach Club Access`
  - Has `Beach Access` only → `Walk to Beach`
  - None of the above → `Off-water`
- **`priceTiers`** — mapped from CSV `Price Range Tags` (e.g., `$800s` maps into the `$500K–$1M` bucket)
- **`lat`/`lng`** — **currently estimates only**. Need real geocoding before launch.

## Known limitations of the mockup (things to fix in production)

### 1. Estimated coordinates
The `lat`/`lng` values in `communities.json` are placeholders derived heuristically from north/mid/south classification + Gulf/Bay offset. Before launch, regeocode all 108 using real addresses. Two approaches:
- **Automated seed:** Google Places API, query = `"{community name}, Longboat Key, FL"`. Expect ~90% accuracy on first pass. Flag low-confidence results for manual review.
- **Manual correction:** Load seeded coordinates into a Google My Maps view, have a team member drag-correct obvious errors (especially inside Bay Isles and LBK Club where many communities cluster tightly).
- **Long-term:** add `Latitude` / `Longitude` columns to the Wix "Neighborhoods & Condos" collection so future additions carry coords natively.

### 2. Location-on-island classifications
The `location` field was hand-assigned based on name cues. Some mid-key communities may be mis-bucketed. Needs team QA.

### 3. Mobile experience
The mockup's mobile layout (under 860px) is a minimal fallback. Production should have a proper mobile-first design: filter drawer that slides up from the bottom, map/list toggle, sticky filter summary chip.

### 4. Community photos
Cards in the mockup are text+icon only. Production should show the `Main Image` from the Wix CSV. Image URLs are in the form `wix:image://v1/...` and need resolution to public CDN URLs via the Wix Media API or pre-processed during the sync step.

### 5. Island outline polygon (optional)
Consider adding a subtle polygon highlight around the Longboat Key outline to visually anchor the map. Either hand-drawn coordinates or pulled from OpenStreetMap's way data.

## Coding conventions

- **Match the Parrish repo's conventions.** If the Parrish repo uses a specific state management pattern, file structure, or naming scheme — follow it. Consistency across the two sister sites matters for long-term maintenance.
- Functional React components only. No class components.
- CSS: match whatever Parrish uses (CSS modules / styled-components / plain CSS — check the repo).
- Keep the color palette close to the mockup (teal primary, coral accent, sand/cream backgrounds) unless the Parrish repo has already established LBK branding.
- Accessibility: filter controls must be keyboard-navigable; map markers need accessible text alternatives.

## Deployment plan

1. New GitHub repo: suggest `life-in-longboat-key-map` (matches the `life-at-lakewood-auto-blogger` pattern)
2. New Firebase project: suggest `life-in-longboat-key` → deploys to `lifeinlongboatkey.web.app`
3. Wix embed: once stable, embed the Firebase URL as an iframe in the `/neighborhoods` page of lifeinlongboatkey.com (matching the Parrish pattern)
4. Mobile fallback: for very small viewports, push users to the full `lifeinlongboatkey.web.app` URL in a new tab (matching Parrish's current behavior) — unless/until a proper mobile design is built

## Open decisions (need your input before launch)

1. **Tile provider** — OSM (free, generic), Mapbox (~$0 for ~50K loads/month, premium look, brand-customizable), or Google Maps ($7/1K loads after $200/mo credit, familiar UX)?
2. **Mobile approach** — redirect like Parrish, or invest in proper mobile design?
3. **Community photos** — does the Wix sync script already resolve image URLs for Parrish? If yes, replicate. If no, this is additional work.
4. **Geocoding execution** — automated seed only, or automated + manual QA pass?
5. **Launch scope** — MVP that matches the mockup exactly, or include community photos + mobile polish in v1?

## Working with this project

When starting a session, first:
1. Read this `CLAUDE.md` file
2. Open `longboat-key-map-mockup.html` in a browser to see the target UX
3. Inspect the data shape in `communities.json`
4. Ask clarifying questions on open decisions before coding

When making changes:
- Keep this file updated as decisions are made (move items from "Open Decisions" → "Architecture Decisions")
- Match Parrish repo conventions unless there's a deliberate reason to diverge
- Never invent data — if a required field is missing, flag it and ask rather than hallucinate
