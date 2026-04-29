#!/usr/bin/env node
// Wix CMS sync.
//
// Pulls items from your Wix `Neighborhoods & Condos` (HousesforSale-
// DynamicPages) collection, maps them onto the local communities.json
// schema, and writes back. Manual step that you commit + push when you
// want the live site to reflect Wix edits.
//
// Run:
//   npm install            # one time, picks up @wix/sdk + dotenv
//   node scripts/sync-from-wix.mjs
//
// Reads three env vars from a gitignored .env:
//   WIX_SITE_ID
//   WIX_API_KEY            (Wix Data: Read items scope is enough)
//   WIX_COLLECTION_ID
//
// Merge strategy:
//   - Sync all CONTENT fields (subtitle, description, price, amenities,
//     YouTube URL, home types, etc.) from Wix into communities.json.
//   - PRESERVE locally-curated geometry (lat, lng, coordSource, images,
//     priceTiers) — those came from hand placement and the polygon import.
//   - Communities only in Wix: appended with a centerline-fallback coord.
//   - Communities only in JSON: left untouched, with a warning.
//
// Run with --dry to print the diff without writing.

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient, ApiKeyStrategy } from '@wix/sdk';
import { items } from '@wix/data';

const COMMUNITIES_PATH = 'src/data/communities.json';
const DRY_RUN = process.argv.includes('--dry');

/**
 * When a Wix item's name doesn't match a local community by exact string,
 * the sync would normally add it as a new entry. These overrides map a
 * Wix-side name to the canonical local name we use after our renames.
 */
const WIX_NAME_OVERRIDES = {
  'Sabal Cove':       'Sabal Cove (Bay Isles)',
  'Queens Harbour':   'Queens Harbour (Bay Isles)',
};

/**
 * Wix items with these names get ignored entirely. Use sparingly — for
 * communities we've intentionally dropped from the local list.
 */
const WIX_SKIP_NAMES = new Set([
  'Harris Bayou',
]);

const { WIX_SITE_ID, WIX_API_KEY, WIX_COLLECTION_ID } = process.env;
for (const [k, v] of Object.entries({ WIX_SITE_ID, WIX_API_KEY, WIX_COLLECTION_ID })) {
  if (!v) {
    console.error(`Missing env var ${k}. Copy .env.example to .env and fill in.`);
    process.exit(1);
  }
}

const client = createClient({
  auth: ApiKeyStrategy({ siteId: WIX_SITE_ID, apiKey: WIX_API_KEY }),
  modules: { items },
});

// -------- helpers --------

/** Pull a value from an item using one of several candidate field names.
 *  Wix CMS field names are user-defined and can drift from the CSV header,
 *  so we try a few common variations before giving up. */
function field(item, ...keys) {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && item[k] !== '') return item[k];
    if (item.data?.[k] !== undefined && item.data[k] !== null && item.data[k] !== '') {
      return item.data[k];
    }
  }
  return undefined;
}

/** Wix sometimes stores yes/no as the literal HTML "<p>Yes</p>" string. */
function isYes(v) {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') return />\s*Yes\s*</i.test(v) || /^yes$/i.test(v.trim());
  return false;
}

/** Resolve a Wix image reference to a public CDN URL.
 *  Handles wix:image://v1/HASH~mv2.ext/filename strings and the SDK's
 *  object form { url: 'https://...' }. Returns undefined for anything
 *  unrecognizable. */
function resolveWixImage(ref) {
  if (!ref) return undefined;
  if (typeof ref === 'object') {
    if (ref.url && typeof ref.url === 'string') return ref.url;
    if (ref.src && typeof ref.src === 'string') return ref.src;
    return undefined;
  }
  if (typeof ref !== 'string') return undefined;
  if (ref.startsWith('http')) return ref;
  const m = ref.match(/^wix:image:\/\/v1\/([^/]+)/);
  if (m) return `https://static.wixstatic.com/media/${m[1]}`;
  return undefined;
}

const ZONE_N_M = 27.40586;
const ZONE_M_S = 27.36114;
function zoneFromLat(lat) {
  if (typeof lat !== 'number') return undefined;
  if (lat >= ZONE_N_M) return 'north';
  if (lat >= ZONE_M_S) return 'mid';
  return 'south';
}

// Price-range parser, copied from the earlier price-tier derivation.
const PRICE_BUCKETS = [
  { label: 'Under $500K',  min: 0,         max: 500000 },
  { label: '$500K–$1M',    min: 500000,    max: 1000000 },
  { label: '$1M–$2M',      min: 1000000,   max: 2000000 },
  { label: '$2M–$5M',      min: 2000000,   max: 5000000 },
  { label: '$5M–$10M',     min: 5000000,   max: 10000000 },
  { label: '$10M–$15M',    min: 10000000,  max: 15000000 },
  { label: '$15M+',        min: 15000000,  max: Infinity },
];
function parseValue(raw) {
  const s = String(raw).trim().replace(/^\$/, '');
  if (/^\d+(?:\.\d+)?M$/i.test(s)) return parseFloat(s) * 1e6;
  if (/^\d+s$/.test(s)) return parseFloat(s) * 1000;
  if (/^\d+K$/i.test(s)) return parseFloat(s) * 1000;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n < 25 ? n * 1e6 : n * 1000;
}
function priceTiersFor(rangeStr) {
  if (!rangeStr) return [];
  const parts = String(rangeStr).split(/\s*[-–—]\s*/);
  const lo = parseValue(parts[0]);
  const hi = parts.length > 1 ? parseValue(parts[1]) : lo;
  if (lo == null || hi == null) return [];
  return PRICE_BUCKETS.filter((b) => lo < b.max && hi >= b.min).map((b) => b.label);
}

/** Rough centerline placement fallback for new communities that don't
 *  have hand-placed coords. Uses the same anchors as before. */
function centerlineCoord(zone) {
  const ANCHORS = {
    north: { lat: 27.418, lng: -82.672 },
    mid:   { lat: 27.387, lng: -82.636 },
    south: { lat: 27.342, lng: -82.595 },
  };
  return ANCHORS[zone] || ANCHORS.mid;
}

// -------- fetch --------

async function fetchAll(collectionId) {
  let page = await client.items.query(collectionId).limit(100).find();
  const out = [...page.items];
  while (page.hasNext()) {
    page = await page.next();
    out.push(...page.items);
  }
  return out;
}

console.log('Fetching items from Wix collection', WIX_COLLECTION_ID, '...');
const all = await fetchAll(WIX_COLLECTION_ID);
console.log('Fetched', all.length, 'items.');

// --- listings join (optional) ---
//
// If WIX_LISTINGS_COLLECTION_ID is set, query that collection and build
// a set of community names that have at least one active listing.
// Communities not in the set get hasListings:false; the 'Currently for
// sale' filter then actually does work.
const LISTINGS_COLLECTION = process.env.WIX_LISTINGS_COLLECTION_ID;
const communitiesWithListings = new Set();
if (LISTINGS_COLLECTION) {
  console.log(`Fetching listings from ${LISTINGS_COLLECTION} ...`);
  const listings = await fetchAll(LISTINGS_COLLECTION);
  console.log('Fetched', listings.length, 'listings.');

  // Build a Wix item ID -> canonical community name map first so we can
  // resolve reference fields on listings.
  const idToName = new Map();
  for (const item of all) {
    const wixName = field(item, 'title', 'neighborhoodName', 'name', 'Neighborhood Name');
    if (!wixName) continue;
    if (WIX_SKIP_NAMES.has(wixName)) continue;
    const name = WIX_NAME_OVERRIDES[wixName] || wixName;
    if (item._id) idToName.set(item._id, name);
  }

  for (const listing of listings) {
    const item = listing.data ? { ...listing, ...listing.data } : listing;
    // Try several candidate field names; reference can be a plain ID
    // string or an object with _id/id/name. Listings might also store
    // the community by name, so we also try a string-name path.
    const candidates = [
      field(item, 'village', 'villageRef', 'neighborhood', 'Neighborhood', 'community', 'parentNeighborhood'),
      field(item, 'villageNameForFiltering', 'villageName', 'neighborhoodName', 'communityName', 'Neighborhood Name'),
    ];
    for (const ref of candidates) {
      if (!ref) continue;
      if (typeof ref === 'object') {
        const name = idToName.get(ref._id || ref.id);
        if (name) { communitiesWithListings.add(name); break; }
        if (ref.name && idToName.has(ref._id)) {
          communitiesWithListings.add(ref.name); break;
        }
      } else if (typeof ref === 'string') {
        // Either a Wix ID or the name itself.
        if (idToName.has(ref)) {
          communitiesWithListings.add(idToName.get(ref)); break;
        }
        // Try as name (also try the override map in reverse).
        const reverseOverride = Object.entries(WIX_NAME_OVERRIDES).find(([wix]) => wix === ref);
        const localName = reverseOverride ? reverseOverride[1] : ref;
        communitiesWithListings.add(localName);
        break;
      }
    }
  }
  console.log(communitiesWithListings.size, 'communities have at least one active listing.');
}

// First-run diagnostic — print one item so we can confirm field names match.
if (all.length > 0 && process.argv.includes('--inspect')) {
  console.log('\nSample item shape (first record):');
  console.log(JSON.stringify(all[0], null, 2));
  process.exit(0);
}

// -------- map --------

const existing = JSON.parse(readFileSync(COMMUNITIES_PATH, 'utf8'));
const byName = new Map(existing.map((c) => [c.name, c]));
const seenNames = new Set();

let updated = 0, added = 0, skipped = 0;
const fieldsChanged = [];

for (const raw of all) {
  // The Wix items API typically nests the user-defined fields under
  // `data` for some endpoints and at the top level for others. `field()`
  // already checks both.
  const item = raw.data ? { ...raw, ...raw.data } : raw;

  const wixName = field(item, 'title', 'villageTitle', 'villageNameForFiltering', 'neighborhoodName', 'name', 'Neighborhood Name');
  if (!wixName) { skipped++; continue; }
  if (WIX_SKIP_NAMES.has(wixName)) { skipped++; continue; }
  const name = WIX_NAME_OVERRIDES[wixName] || wixName;
  seenNames.add(name);

  // Home types — tag array preferred over the comma-separated string.
  const rawHomeTypes = field(item, 'homeTypeTags', 'homeTypes', 'Home Type Tags', 'Home Types');
  const homeTypes = Array.isArray(rawHomeTypes)
    ? rawHomeTypes.filter(Boolean)
    : (typeof rawHomeTypes === 'string'
        ? rawHomeTypes.split(',').map((s) => s.trim()).filter(Boolean)
        : []);

  // Condo vs neighborhood — Wix collection no longer surfaces an explicit
  // condoCommunity boolean for every record (Jewfish Key, a neighborhood,
  // doesn't have the field at all). Fall back to homeTypeTags: anything
  // tagged 'Condominiums' is a condo community.
  const explicitCondo = field(item, 'condoCommunity', 'condoCommunity_', 'Condo Community?');
  const isCondo = explicitCondo !== undefined
    ? isYes(explicitCondo)
    : homeTypes.includes('Condominiums');

  // Pull content fields with fallbacks.
  const updates = {
    type: isCondo ? 'condo' : 'neighborhood',
    subtitle: field(item, 'villageSubtitle', 'neighborhoodSubtitle', 'subtitle', 'Neighborhood Subtitle'),
    shortDescription: field(item, 'villageShortDescription', 'neighborhoodShortDescription', 'shortDescription', 'Neighborhood Short Description'),
    priceRange: field(item, 'priceRange', 'Price Range'),
    sqft: field(item, 'squareFeet', 'sqft', 'Square Feet'),
    bedrooms: field(item, 'bedroomRange', 'bedrooms', 'Bedrooms'),
    youtubeUrl: field(item, 'youtubeVideo', 'youtubeUrl', 'YouTube Video') || undefined,
    pageUrl: field(item, 'link-villages-title', 'link-houses-for-sale-dynamic-pages-title', 'pageUrl', 'slug') || undefined,
    imageUrl: resolveWixImage(field(item, 'aboutNeighborhoodImage', 'mainImage', 'main_image', 'image', 'Main Image')) || undefined,
    is55plus: isYes(field(item, '55Text-YesOrNo', 'ageRestrictedTextYesOrNo', 'is55plus', '55+ Text - Yes or No')),
    homeTypes,
  };

  // Amenities — try a multi-select tag field first, then fall back to
  // per-amenity Yes/No columns.
  const amenityTags = field(item, 'amenitiesTags', 'amenities', 'Amenities Tags');
  let amenities = [];
  if (Array.isArray(amenityTags)) {
    amenities = amenityTags.filter(Boolean);
  } else {
    const PAIRS = [
      ['Gated', ['gatedTextYesOrNo', 'gated']],
      ['Beach Access', ['beachAccessYesOrNo', 'beachAccess']],
      ['Private Beach', ['privateBeachYesOrNo', 'privateBeach']],
      ['Marina Access', ['marinaAccessYesOrNo', 'marinaAccess']],
      ['Personal Boat Slips', ['personalBoatSlipsYesOrNo', 'personalBoatSlips']],
      ['Tennis', ['tennisTextYesOrNo', 'tennis']],
      ['Pickleball', ['pickleballTextYesOrNo', 'pickleball']],
      ['Golf', ['golfTextYesOrNo', 'golf']],
      ['Community Pool', ['poolTextYesOrNo', 'pool']],
      ['Fitness Center', ['fitnessCenterTextYesOrNo', 'fitnessCenter']],
      ['Clubhouse', ['clubhouseTextYesOrNo', 'clubhouse']],
      ['Walking Paths', ['walkingPathsTextYesOrNo', 'walkingPaths']],
      ['Free Maintenance', ['maintenanceIncludedTextYesOrNo', 'maintenanceIncluded']],
    ];
    for (const [label, keys] of PAIRS) {
      if (isYes(field(item, ...keys))) amenities.push(label);
    }
  }
  updates.amenities = amenities;

  // is55plus fallback — if the YN field was empty/unset but the
  // amenity multi-select includes '55+Communities', treat it as 55+.
  if (!updates.is55plus && amenities.includes('55+Communities')) {
    updates.is55plus = true;
  }

  // Home types — tag array OR comma-separated string. Already computed
  // above (we needed it for the condo/neighborhood heuristic); the
  // updates.homeTypes was set when the updates object was built.

  // Bedroom tags — Wix exposes bedroomTags as the canonical multi-select.
  const bedTagsRaw = field(item, 'bedroomTags', 'bedTags', 'Bedroom Tags');
  if (Array.isArray(bedTagsRaw)) updates.bedTags = bedTagsRaw.map(String);
  else if (typeof updates.bedrooms === 'string') {
    const m = updates.bedrooms.match(/(\d+)/g);
    if (m) {
      const lo = parseInt(m[0], 10);
      const hi = parseInt(m[m.length - 1], 10);
      const out = [];
      for (let n = lo; n <= hi; n++) out.push(String(n));
      updates.bedTags = out;
    }
  }

  // Re-derive priceTiers from priceRange.
  if (updates.priceRange) updates.priceTiers = priceTiersFor(updates.priceRange);

  // Strip undefined values so we don't blow away existing fields with `undefined`.
  for (const k of Object.keys(updates)) if (updates[k] === undefined) delete updates[k];

  let c = byName.get(name);
  if (!c) {
    // New community — make a stub. Coords default to centerline; user
    // can hand-place later via scripts/place-condos.mjs.
    const coord = centerlineCoord(updates.is55plus ? 'mid' : 'mid');
    c = {
      name,
      lat: coord.lat,
      lng: coord.lng,
      coordSource: 'centerline',
      hasListings: true,
      waterfront: [],
      location: zoneFromLat(coord.lat),
    };
    existing.push(c);
    byName.set(name, c);
    added++;
  }

  // Track what changes for the report.
  const before = JSON.stringify(c);
  Object.assign(c, updates);
  // Re-derive zone from current lat — Wix doesn't own coords, but lat
  // could be stale if a previous run wrote one.
  c.location = zoneFromLat(c.lat) || c.location;
  // Listings join — only run when the listings collection is configured.
  if (LISTINGS_COLLECTION) {
    c.hasListings = communitiesWithListings.has(name);
  }
  const after = JSON.stringify(c);
  if (before !== after) {
    updated++;
    fieldsChanged.push(name);
  }
}

// Communities present locally but not in Wix — flag them.
const orphaned = existing.filter((c) => !seenNames.has(c.name)).map((c) => c.name);

// -------- write --------

if (DRY_RUN) {
  console.log('\n--dry: not writing communities.json');
} else {
  writeFileSync(COMMUNITIES_PATH, JSON.stringify(existing) + '\n');
  console.log('\nWrote', COMMUNITIES_PATH);
}

console.log(`\nResult: ${added} added, ${updated} updated, ${skipped} skipped (no name).`);
if (orphaned.length) {
  console.log(`\n${orphaned.length} communities exist locally but were NOT in the Wix response:`);
  for (const n of orphaned.slice(0, 20)) console.log(' ', n);
  if (orphaned.length > 20) console.log(`  ... and ${orphaned.length - 20} more`);
  console.log('(These are left untouched. Investigate if unexpected.)');
}
if (added > 0) {
  console.log(`\n${added} new communities were appended. They got centerline-fallback`);
  console.log('coordinates — re-run scripts/place-condos.mjs or supply hand-placed');
  console.log('coords if you want pin-accurate placement.');
}
