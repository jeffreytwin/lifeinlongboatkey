#!/usr/bin/env node
// One-time cleanup of duplicate community records created by Wix renames.
//
// Before the sync script learned to match on Wix _id, renaming a community
// in Wix caused the next sync to append a NEW local record (with
// centerline-fallback coords) and leave the OLD record orphaned. Several
// pairs accumulated this way.
//
// For each pair below, this script copies the locally-curated geometry
// (lat, lng, coordSource, waterfront) and any youtubeUrl from the
// orphaned (donor) record onto the active (keep) record that matches the
// current Wix name, then deletes the donor.
//
// Safe to run once. After this and the id-matching sync change, future
// renames will update in place.

import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/data/communities.json';

// [keep (= current Wix name), donor (= orphan with the real coords)]
const PAIRS = [
  ['Privateer',                    'Privateer (Longboat Key Club)'],
  ['Inn on the Beach',             'Inn on the Beach (Longboat Key Club)'],
  ['Pierre',                       'Pierre (Longboat Key Club)'],
  ['Regent Place',                 'Regent Place (Longboat Key Club)'],
  ['The Sanctuary',                'The Sanctuary (Longboat Key Club)'],
  ['The Beaches',                  'The Beaches (Longboat Key Club)'],
  ['Longboat Key Towers',          'Longboat Key Towers (Longboat Key Club)'],
  ['Regent Court',                 'Regent Court (Longboat Key Club)'],
  ["L'Ambiance",                   "L'Ambiance (Longboat Key Club)"],
  // Goes the other direction — Wix kept the "(Bay Isles)" suffix;
  // the local "Corey's Landing" record is the orphan.
  ["Corey's Landing (Bay Isles)",  "Corey's Landing"],
];

const ZONE_N_M = 27.40586;
const ZONE_M_S = 27.36114;
const zoneFromLat = (lat) =>
  lat >= ZONE_N_M ? 'north' : lat >= ZONE_M_S ? 'mid' : 'south';

const data = JSON.parse(readFileSync(PATH, 'utf8'));
const byName = new Map(data.map((c) => [c.name, c]));
const remove = new Set();

let merged = 0;
for (const [keepName, donorName] of PAIRS) {
  const keep = byName.get(keepName);
  const donor = byName.get(donorName);
  if (!keep || !donor) {
    console.warn(`skip: missing ${!keep ? `keep "${keepName}"` : `donor "${donorName}"`}`);
    continue;
  }
  keep.lat = donor.lat;
  keep.lng = donor.lng;
  keep.coordSource = donor.coordSource;
  if (Array.isArray(donor.waterfront) && donor.waterfront.length > 0) {
    keep.waterfront = donor.waterfront;
  }
  if (donor.youtubeUrl && !keep.youtubeUrl) {
    keep.youtubeUrl = donor.youtubeUrl;
  }
  keep.location = zoneFromLat(keep.lat);
  remove.add(donorName);
  merged++;
  console.log(`merged: "${donorName}" -> "${keepName}"  (${keep.coordSource} ${keep.lat}, ${keep.lng})`);
}

const out = data.filter((c) => !remove.has(c.name));
writeFileSync(PATH, JSON.stringify(out) + '\n');

console.log(`\n${merged} pairs merged, ${data.length - out.length} records removed.`);
console.log(`${out.length} communities remain (was ${data.length}).`);
