# Session handoff — read this first

The previous session couldn't push to `origin/main` because the session's
git-proxy credential stopped working mid-session. **3 commits are sitting
locally on `main`** waiting to fly out.

## First thing to do

```sh
git status                 # should show "Your branch is ahead of 'origin/main' by N commits"
git push origin main
```

Assuming that succeeds: delete this file and commit:

```sh
rm SESSION_HANDOFF.md
git commit -am "Clear session handoff note after successful push"
git push origin main
```

## The commits that were stuck

| SHA       | Description |
|-----------|-------------|
| `975eae9` | Remove Harris Bayou from the community list (user opted against supplying a polygon for it) |
| `b7dbf7e` | Move North End bubble onto the island (was in the Gulf); remove Waterfront filter section |
| `cb046dc` | Add $5M–$10M / $10M–$15M / $15M+ price buckets; move Location-on-Island filter below Amenities |

If the push fails with `fatal: could not read Password for 'http://local_proxy@127.0.0.1:...'`
it means your session also has the broken proxy. Try starting one more fresh session.

## Where the project stands after these push

- **107 communities total** = 77 condos + 30 neighborhoods
- **All 77 condos** have user-supplied real coordinates (`coordSource: "placed"`)
- **All 30 neighborhoods** have polygons in `src/data/neighborhoods.geojson`
  (`coordSource: "polygon"`, with centroid stored as lat/lng)
- Live site: https://lifeinlongboatkey.web.app (Firebase Hosting)
- Auto-deploys via `.github/workflows/deploy.yml` on push to `main`
- Required GitHub secrets already set: `FIREBASE_SERVICE_ACCOUNT`, `MAPBOX_ACCESS_TOKEN`

## User preferences locked in this session

- **Push directly to `main` — no PR gate.** User explicitly said "forget the PR gate —
  this is a fresh project, not an established app." Skip `gh pr create`. Skip asking.
- **Don't open PRs unless asked.** User merges via direct push.
- **Bulk uploads via GitHub web UI land in the repo root** (e.g. `map (10).geojson`,
  `Condo Example.jpg`). Move them to the correct path and commit.
- **Be frugal with small talk.** User wants terse, action-oriented updates.

## Key session-learned facts (also captured in CLAUDE.md)

- **LBK ground-truth anchor coordinates** (used by `scripts/*` and for zone boundaries):
  - north: `27.42696, -82.67443`
  - mid:   `27.38476, -82.63640`
  - south: `27.33751, -82.59538`
- **Zone boundary latitudes** (midpoints between anchors):
  - North/Mid boundary: `27.40586`
  - Mid/South boundary: `27.36114`
- **ZONE_ZOOM_THRESHOLD = 13** in `map.js`. Below: three big zone bubbles. At/above:
  individual pins + polygons.
- **Amenities filter is AND** (must have all checked); other multi-select filters are OR.
- **Waterfront filter was removed** from the UI but state + matching logic stay inert in
  `filters.js` / `matches.js` — don't rip them out unless asked.
- **Two scripts in `scripts/`** are rerunnable data-refresh tools, not one-time migrations:
  - `place-condos.mjs` — applies the KNOWN coordinate table to condos
  - `import-neighborhood-polygons.mjs` — normalizes/renames a user-drawn GeoJSON
    (currently expects it at `./map (10).geojson` in the repo root; rename + re-run
    on the next upload)

## Open items the user may bring up next

- **Harris Bayou** — removed for now, may come back with a polygon later
- **Mobile experience** — still a minimal stack fallback; real mobile drawer is a
  scoped follow-up from CLAUDE.md
- **Live Wix data fetch** — static `communities.json` for MVP; switch to `@wix/data`
  is a follow-up (see CLAUDE.md)
- **Wix-iframe embed** — `postMessage` listener not wired yet
- **Neighborhood photo image overrides** — cards currently show the same placeholder
  for all neighborhoods; real per-community photos can be dropped in via an
  `imageUrl` field on each community (`communityPhotoUrl` in `utils.js` already honors it)
