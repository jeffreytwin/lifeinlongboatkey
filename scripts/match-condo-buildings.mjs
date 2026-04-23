#!/usr/bin/env node
// Match each building footprint in lbk-buildings.geojson to its nearest
// condo community in communities.json, then emit one MultiPolygon feature
// per condo (the union of its buildings) to src/data/condo-buildings.geojson.
//
// Algorithm: for every building, find the closest condo centroid. If within
// MAX_DIST_M it's "theirs"; otherwise it's unassigned and dropped. This
// Voronoi-with-cutoff approach is deterministic, prevents double-claims,
// and leaves neighbor-free buildings (single-family homes, commercial)
// out of the output.

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const BUILDINGS     = 'lbk-buildings.geojson';
const COMMUNITIES   = 'src/data/communities.json';
const OUT           = 'src/data/condo-buildings.geojson';

const MAX_DIST_M = 80;   // building centroid must be within this of a condo centroid
const LAT_M      = 111000;
const LNG_M      = 98700; // at LBK's latitude (~27.4)

function distMeters(a, b) {
  const dLat = (a[1] - b[1]) * LAT_M;
  const dLng = (a[0] - b[0]) * LNG_M;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function polygonCentroid(ring) {
  let cx = 0, cy = 0, area = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
    area += cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-12) {
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
    return [sx / n, sy / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

const buildings   = JSON.parse(readFileSync(BUILDINGS, 'utf8'));
const communities = JSON.parse(readFileSync(COMMUNITIES, 'utf8'));
const condos      = communities.filter((c) => c.type === 'condo' && typeof c.lat === 'number');

// For each condo, hold the list of polygon-coordinate arrays we'll union.
const assignments = new Map();
let unassigned = 0;

for (const feature of buildings.features) {
  const geom = feature.geometry;
  if (!geom) continue;
  // Only the outer ring of the first polygon is used for the centroid check.
  const outer = geom.type === 'Polygon'
    ? geom.coordinates[0]
    : geom.type === 'MultiPolygon'
      ? geom.coordinates[0][0]
      : null;
  if (!outer || outer.length < 4) continue;

  const buildingCentroid = polygonCentroid(outer);

  let nearest = null;
  let nearestDist = Infinity;
  for (const condo of condos) {
    const d = distMeters(buildingCentroid, [condo.lng, condo.lat]);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = condo;
    }
  }

  if (!nearest || nearestDist > MAX_DIST_M) {
    unassigned++;
    continue;
  }

  if (!assignments.has(nearest.name)) assignments.set(nearest.name, []);

  // Normalize to MultiPolygon coordinate shape: every assigned piece is
  // stored as a "polygon's coordinates" (array of rings).
  if (geom.type === 'Polygon') {
    assignments.get(nearest.name).push(geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) assignments.get(nearest.name).push(poly);
  }
}

// Build output FeatureCollection — one MultiPolygon feature per condo.
const features = [];
for (const [name, polys] of assignments) {
  features.push({
    type: 'Feature',
    properties: { name },
    geometry: { type: 'MultiPolygon', coordinates: polys },
  });
}
features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }) + '\n');

// Tag every matched condo with coordSource='polygon' so the map logic that
// already handles neighborhoods works the same way for condos.
for (const c of communities) {
  if (c.type !== 'condo') continue;
  if (assignments.has(c.name)) c.coordSource = 'polygon';
}
writeFileSync(COMMUNITIES, JSON.stringify(communities) + '\n');

console.log(`Condos with buildings matched: ${features.length} / ${condos.length}`);
console.log(`Buildings ignored (too far from any condo): ${unassigned}`);

const missing = condos.filter((c) => !assignments.has(c.name))
  .sort((a, b) => a.name.localeCompare(b.name));
if (missing.length) {
  console.log(`\nCondos with NO matching footprint (most likely Manatee County side):`);
  for (const c of missing) {
    console.log(`  - ${c.name.padEnd(36)} (lat ${c.lat.toFixed(4)})`);
  }
}
