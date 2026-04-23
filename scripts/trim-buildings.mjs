#!/usr/bin/env node
// One-time trim: clip a large GeoJSON to just the LBK bbox and strip
// non-geometry properties. Typical Sarasota-County-wide building footprint
// downloads are ~150-200 MB; LBK is a narrow strip so output should land
// well under 5 MB.
//
// Usage:
//   node scripts/trim-buildings.mjs <input.geojson> [output.geojson]
// If the input is large enough that Node runs out of heap:
//   node --max-old-space-size=4096 scripts/trim-buildings.mjs ...

import { readFileSync, writeFileSync, statSync } from 'node:fs';

const IN = process.argv[2];
const OUT = process.argv[3] || 'lbk-buildings.geojson';

if (!IN) {
  console.error('Usage: trim-buildings.mjs <input.geojson> [output.geojson]');
  process.exit(1);
}

// Longboat Key bbox. Slightly padded to catch features that straddle the
// edge. Covers the whole island end-to-end; Sarasota-only sources will
// still leave the Manatee (north) half empty, but that's separate data.
const BBOX = { w: -82.710, s: 27.305, e: -82.560, n: 27.445 };

function inBbox([lng, lat]) {
  return lng >= BBOX.w && lng <= BBOX.e && lat >= BBOX.s && lat <= BBOX.n;
}

// Recurse through nested coordinate arrays; return true if any point
// falls inside the bbox.
function anyPointInBbox(coords) {
  if (!Array.isArray(coords)) return false;
  if (typeof coords[0] === 'number') return inBbox(coords);
  for (const sub of coords) if (anyPointInBbox(sub)) return true;
  return false;
}

const inputBytes = statSync(IN).size;
console.error(`Reading ${IN} (${(inputBytes / 1e6).toFixed(1)} MB)...`);
const data = JSON.parse(readFileSync(IN, 'utf8'));
console.error(`Parsed ${data.features.length} features`);

const kept = [];
for (const f of data.features) {
  if (!f.geometry) continue;
  if (!anyPointInBbox(f.geometry.coordinates)) continue;
  // Strip properties — we match by geometry/proximity later.
  kept.push({ type: 'Feature', geometry: f.geometry, properties: {} });
}

writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features: kept }));
const outBytes = statSync(OUT).size;
console.error(`Kept ${kept.length} / ${data.features.length} features`);
console.error(`Wrote ${OUT} (${(outBytes / 1e6).toFixed(2)} MB)`);
