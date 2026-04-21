#!/usr/bin/env node
// Deterministically place all communities along the LBK centerline based on
// zone + waterfront type. Not exact geocoding — a sanity-first placeholder
// that guarantees every pin is on the island. Replace with a Mapbox/Places
// geocoding pass when one is available.

import { readFileSync, writeFileSync } from 'node:fs';

const IN = 'src/data/communities.json';
const data = JSON.parse(readFileSync(IN, 'utf8'));

// LBK island spine (NW to SE). Centerline as linear fn of latitude.
const NORTH_TIP = { lat: 27.4260, lng: -82.6910 };
const SOUTH_TIP = { lat: 27.3180, lng: -82.5785 };

function centerLng(lat) {
  const t = (lat - SOUTH_TIP.lat) / (NORTH_TIP.lat - SOUTH_TIP.lat);
  return SOUTH_TIP.lng + t * (NORTH_TIP.lng - SOUTH_TIP.lng);
}

// Zones — latitude bands with some headroom so the spread doesn't crash into
// the ends of the island.
const ZONES = {
  north: { latMin: 27.400, latMax: 27.424 },
  mid:   { latMin: 27.370, latMax: 27.400 },
  south: { latMin: 27.322, latMax: 27.370 },
};

// East/west offset from centerline based on waterfront classification.
// Island half-width is roughly 0.005 longitude (~0.3 miles at this latitude).
function waterfrontOffset(wf) {
  const set = new Set(wf || []);
  if (set.has('Gulf-front')) return -0.0045;       // Gulf side (west)
  if (set.has('Bay-front')) return +0.0045;        // Bay side (east)
  if (set.has('Beach Club Access')) return -0.002; // slightly west
  if (set.has('Walk to Beach')) return -0.001;     // slightly west
  return 0;                                         // off-water: centerline
}

// Small deterministic jitter so two identically-classified neighbors don't
// stack exactly on top of each other.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}
function jitter(name, scale) {
  const h = hash(name);
  return (((h % 1000) / 1000) - 0.5) * scale;
}

// Distribute communities within each zone: sort by stable key and spread
// evenly across the latitude band.
const byZone = { north: [], mid: [], south: [] };
for (const c of data) {
  const z = byZone[c.location] ? c.location : 'mid';
  byZone[z].push(c);
}

for (const [zone, list] of Object.entries(byZone)) {
  list.sort((a, b) => a.name.localeCompare(b.name));
  const { latMin, latMax } = ZONES[zone];
  const n = list.length;
  list.forEach((c, i) => {
    // Evenly spaced lat within the zone
    const lat = latMin + ((i + 0.5) / n) * (latMax - latMin) + jitter(c.name, 0.0015);
    const lng = centerLng(lat) + waterfrontOffset(c.waterfront) + jitter(c.name + 'x', 0.0014);
    c.lat = +lat.toFixed(6);
    c.lng = +lng.toFixed(6);
  });
}

writeFileSync(IN, JSON.stringify(data) + '\n');
console.log(`Regenerated coordinates for ${data.length} communities`);
console.log(`  north: ${byZone.north.length}, mid: ${byZone.mid.length}, south: ${byZone.south.length}`);
