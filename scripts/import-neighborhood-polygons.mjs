#!/usr/bin/env node
// One-time pass: take the user-drawn GeoJSON from the repo root, normalize it
// into src/data/neighborhoods.geojson (deduped, renamed to match
// communities.json), and update each matching neighborhood in
// communities.json with its polygon centroid as lat/lng.

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const SRC = 'map (10).geojson';
const OUT_GEOJSON = 'src/data/neighborhoods.geojson';
const OUT_COMMUNITIES = 'src/data/communities.json';

// Map user-supplied Neighborhood property values -> canonical name in
// communities.json. Anything not here is assumed to match verbatim.
const NAME_MAP = {
  'Coreys Landing':                 "Corey's Landing",
  'Bay Isles - Sabal Cove':         'Sabal Cove',
  'Bay Isles - Winding Oaks':       'Winding Oaks (Bay Isles)',
  'Bay Isles - Weston Pointe':      'Weston Pointe (Bay Isles)',
  'Bay Isles - The Bayou':          'The Bayou (Bay Isles)',
  'Regent Court':                   'Regent Court (Longboat Key Club)',
  'Bay Isles - Harbour Links':      'Harbour Links (Bay Isles)',
  'Bay Isles - Harbour Oaks':       'Harbour Oaks (Bay Isles)',
  'Bay Isles - Harbor Court':       'Harbour Court (Bay Isles)',
  'Bay Isles - Harbour Circle':     'Harbour Circle (Bay Isles)',
  'Bay Isles - Emerald Pointe':     'Emerald Pointe (Bay Isles)',
  'Spanish Main Yacht Club':        'Spanish Main Yacht Club (55+)',
};

function canonName(raw) {
  return NAME_MAP[raw] || raw;
}

// Proper signed-area polygon centroid.
function centroid(ring) {
  let cx = 0, cy = 0, a = 0;
  const n = ring.length - 1; // ring is closed (first === last)
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
    a += cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {
    // Degenerate — fall back to vertex mean.
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
    return [sx / n, sy / n];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const communities = JSON.parse(readFileSync(OUT_COMMUNITIES, 'utf8'));

// Dedupe: if the same name appears twice, keep the one with the most
// vertices (presumed more refined).
const byName = new Map();
for (const f of raw.features) {
  const rawName = f.properties.Neighborhood || f.properties.Neigbhorhood;
  if (!rawName) continue;
  const name = canonName(rawName);
  const ring = f.geometry.coordinates[0];
  const prev = byName.get(name);
  if (!prev || ring.length > prev.ring.length) {
    byName.set(name, { name, ring, geometry: f.geometry });
  }
}

const cleanedFeatures = [];
const placed = [], unmatched = [];
const matchedNames = new Set();

for (const { name, ring, geometry } of byName.values()) {
  const nbhd = communities.find((c) => c.name === name && c.type === 'neighborhood');
  if (!nbhd) {
    unmatched.push(name);
    continue;
  }
  const [lng, lat] = centroid(ring);
  nbhd.lat = +lat.toFixed(6);
  nbhd.lng = +lng.toFixed(6);
  nbhd.coordSource = 'polygon';
  matchedNames.add(name);
  placed.push(name);

  cleanedFeatures.push({
    type: 'Feature',
    properties: { name },
    geometry,
  });
}

// Neighborhoods in communities.json that did NOT get a polygon
const stillPointBased = communities
  .filter((c) => c.type === 'neighborhood' && !matchedNames.has(c.name))
  .map((c) => c.name);

// Write cleaned GeoJSON (sorted by name for stable diffs)
cleanedFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
writeFileSync(
  OUT_GEOJSON,
  JSON.stringify({ type: 'FeatureCollection', features: cleanedFeatures }, null, 2) + '\n'
);

writeFileSync(OUT_COMMUNITIES, JSON.stringify(communities) + '\n');

// Remove the upload from the repo root — we have it normalized in src/data now
if (existsSync(SRC)) unlinkSync(SRC);

console.log(`Polygons matched & placed: ${placed.length}`);
console.log(`Neighborhoods with no polygon yet: ${stillPointBased.length}`);
if (stillPointBased.length) {
  stillPointBased.forEach((n) => console.log(`  - ${n}`));
}
if (unmatched.length) {
  console.log(`\nGeoJSON names with no matching community (skipped):`);
  unmatched.forEach((n) => console.log(`  - ${n}`));
}
