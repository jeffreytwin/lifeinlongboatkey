#!/usr/bin/env node
// Hand-placement pass for condos I can identify with reasonable confidence,
// plus tight clustering for named resort/gated-community groups. Writes
// back to communities.json with a coordSource field per community:
//   placed:     individual coordinate from the KNOWN table
//   clustered:  member of a named group (LBK Club, Bay Isles, etc.);
//               positioned within a small jitter around the group center
//   centerline: no specific knowledge; kept on the zone centerline (existing)

import { readFileSync, writeFileSync } from 'node:fs';

const IN = 'src/data/communities.json';
const data = JSON.parse(readFileSync(IN, 'utf8'));

// -----------------------------------------------------------------------
// Individual hand-placements. Coordinates are my best estimates from
// public knowledge of LBK — not survey-accurate. Review & correct as
// needed; any updates here overwrite on the next script run.
// -----------------------------------------------------------------------
const KNOWN = {
  // North end
  'Whitney Beach':              { lat: 27.42250, lng: -82.68210 }, // north-bay, near pass
  'Longboat Harbour':           { lat: 27.41700, lng: -82.67350 }, // north-village, bay
  'Longboat Harbour Towers':    { lat: 27.41850, lng: -82.67420 }, // adjacent to Longboat Harbour

  // Mid-key — well-documented high-rises along the mid-key Gulf side
  'The Grande at Longboat Key': { lat: 27.39250, lng: -82.64830 }, // mid-key Gulf-front
  'Water Club':                 { lat: 27.39550, lng: -82.65100 }, // mid-key Gulf-front luxury
  'Promenade':                  { lat: 27.39050, lng: -82.64560 }, // mid-key Gulf-side

  // South — LBK Club main resort reference point (Gulf-side, south end)
  'Longboat Key Club':          { lat: 27.32650, lng: -82.58700 },

  // South — other known landmarks
  'Tangerine Bay Club':         { lat: 27.34050, lng: -82.60260 }, // bay, adjacent to Bay Isles
  'Islander Club':              { lat: 27.34600, lng: -82.60120 }, // south Gulf-side beachfront
  'Vizcaya':                    { lat: 27.35300, lng: -82.60680 }, // mid-south Gulf-front
  'Sage Longboat Key':          { lat: 27.34900, lng: -82.60420 }, // newer luxury Gulf-front
  'Aria':                       { lat: 27.35100, lng: -82.60520 }, // newer luxury Gulf-front
  'The Residences at The St. Regis': { lat: 27.35600, lng: -82.60900 }, // former Colony site
  'Beachplace':                 { lat: 27.34800, lng: -82.60340 }, // south Gulf-side
  'Harbour Villa Club':         { lat: 27.34350, lng: -82.60100 }, // bay-side south
};

// -----------------------------------------------------------------------
// Named-group clusters. All members get placed in a tight cluster around
// the group center, ordered alphabetically within it. The spread is
// deliberately small (0.003° ≈ 0.2 mi) so they read as "inside the
// same development."
// -----------------------------------------------------------------------
const CLUSTERS = [
  {
    // Longboat Key Club gated resort, south-Gulf side. Beachfront condos
    // strung along a ~1-mile stretch of Gulf of Mexico Dr.
    nameSuffix: '(Longboat Key Club)',
    center: { lat: 27.32800, lng: -82.58800 },
    spread: { lat: 0.00600, lng: 0.00180 },  // string roughly N-S along beach
  },
  {
    // Bay Isles gated community, south-bay side. Compact layout around
    // the marina and golf course.
    nameSuffix: '(Bay Isles)',
    center: { lat: 27.33700, lng: -82.59850 },
    spread: { lat: 0.00180, lng: 0.00140 },
  },
];

function hash(s){ let h=0; for(const ch of s) h=(h*31+ch.charCodeAt(0))|0; return h; }
function normJitter(s){ return ((hash(s) % 1000) / 1000) - 0.5; }

let placedCount = 0, clusteredCount = 0;
const remaining = [];

for (const c of data) {
  if (c.type !== 'condo') { continue; }

  // 1) Individual hand-placement
  if (KNOWN[c.name]) {
    c.lat = +KNOWN[c.name].lat.toFixed(6);
    c.lng = +KNOWN[c.name].lng.toFixed(6);
    c.coordSource = 'placed';
    placedCount++;
    continue;
  }

  // 2) Named-group cluster
  const cluster = CLUSTERS.find((cl) => c.name.includes(cl.nameSuffix));
  if (cluster) {
    // Deterministic offset within the cluster from the name hash. Keeps
    // the same community in the same spot across re-runs.
    const jLat = normJitter(c.name) * cluster.spread.lat;
    const jLng = normJitter(c.name + 'x') * cluster.spread.lng;
    c.lat = +(cluster.center.lat + jLat).toFixed(6);
    c.lng = +(cluster.center.lng + jLng).toFixed(6);
    c.coordSource = 'clustered';
    clusteredCount++;
    continue;
  }

  // 3) Fallback: leave centerline coords in place; mark for user review
  c.coordSource = 'centerline';
  remaining.push(c);
}

writeFileSync(IN, JSON.stringify(data) + '\n');

console.log(`Placed individually : ${placedCount}`);
console.log(`Placed by cluster   : ${clusteredCount}`);
console.log(`Remaining on line   : ${remaining.length}`);
console.log('\nRemaining condos still on centerline (by zone):\n');
for (const z of ['north', 'mid', 'south']) {
  const list = remaining.filter((c) => c.location === z).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) continue;
  console.log(`  ${z.toUpperCase()} (${list.length}):`);
  for (const c of list) console.log(`    ${c.name.padEnd(34)}  [${(c.waterfront || []).join(', ') || '-'}]`);
}
