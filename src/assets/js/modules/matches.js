/**
 * Filter + sort logic.
 *
 * Ported verbatim from docs/longboat-key-map-mockup.html lines 748–773.
 */

import { state } from './state.js';

const PRICE_ORDER = {
  'Under $500K': 0,
  '$500K–$1M': 1,
  '$1M–$2M': 2,
  '$2M–$5M': 3,
  '$5M–$10M': 4,
  '$10M–$15M': 5,
  '$15M+': 6,
};

/** Map a numeric listing price to one of the chip-row price tiers. */
export function priceToTier(p) {
  if (p == null || !Number.isFinite(p)) return null;
  if (p < 500_000)    return 'Under $500K';
  if (p < 1_000_000)  return '$500K–$1M';
  if (p < 2_000_000)  return '$1M–$2M';
  if (p < 5_000_000)  return '$2M–$5M';
  if (p < 10_000_000) return '$5M–$10M';
  if (p < 15_000_000) return '$10M–$15M';
  return '$15M+';
}

/** Normalize a home-type label for comparison (case + plural-s). */
function normHomeType(t) {
  return t ? String(t).toLowerCase().replace(/s\b/g, '').trim() : '';
}

/** Listing-vocab → community-vocab (chip-row label) lookup. The HousesforSale
 *  collection uses different wording than the village home-type tags
 *  (e.g. "Single Family Residence" vs "Single Family Homes",
 *  "Townhouse" vs "Townhomes"), so the alias map bridges them. The
 *  "Condo - Hotel" subtype rolls up into Condominiums for filter
 *  purposes. */
const LISTING_TO_COMMUNITY_HOME_TYPE = new Map([
  ['condominium',              'Condominiums'],
  ['condo - hotel',            'Condominiums'],
  ['condo-hotel',              'Condominiums'],
  ['single family residence',  'Single Family Homes'],
  ['single family home',       'Single Family Homes'],
  ['villa',                    'Villas'],
  ['townhouse',                'Townhomes'],
  ['townhome',                 'Townhomes'],
]);

/** Given a listing's homeType, return the community-vocabulary chip
 *  label it should contribute to (or null if no mapping exists, e.g.
 *  "Half Duplex"). The communityTypes parameter is kept for API
 *  stability and used as a courtesy intersection so we don't surface
 *  a label that no community in the dataset actually carries — when
 *  it's provided. Pass an empty array (or omit) to skip the
 *  intersection. */
export function mapListingHomeType(listingType, communityTypes) {
  const lt = normHomeType(listingType);
  if (!lt) return null;
  const label = LISTING_TO_COMMUNITY_HOME_TYPE.get(lt);
  if (!label) return null;
  // Listings filter against the chip vocabulary regardless of the
  // listing's home community, so listings with a homeType that maps to
  // a valid chip label always count — even if their own community
  // isn't tagged with it. Callers can still pass communityTypes when
  // they want a tighter intersection, but the default is the looser
  // chip-driven view that matches user expectations.
  return label;
}

/** True when any filter that applies at the individual-listing level is
 *  active. Amenities / Location / 55+ / Community Type are community
 *  attributes and aren't listing-level, so they're deliberately excluded. */
export function hasListingLevelFilters() {
  return state.priceTiers.size > 0 || state.homeTypes.size > 0 || state.bedrooms.size > 0;
}

/** A vacant-land / lot listing, treated as the 'Land' home type for
 *  filtering. The feed now tags these explicitly (homeType "Land"); the
 *  legacy shape had no home type, no bedrooms, and zero building sqft, and
 *  that heuristic is kept as a fallback in case the feed reverts. */
export function isLandListing(l) {
  if (!l) return false;
  if (/^(vacant\s+)?(land|lot)s?$/i.test(String(l.homeType ?? '').trim())) return true;
  const noType = l.homeType == null || String(l.homeType).trim() === '';
  const noBeds = l.beds == null;
  const noSqft = l.sqftText == null || l.sqftText === '' || l.sqftText === '0';
  return noType && noBeds && noSqft;
}

/** Highest bedroom chip. The top chip is treated as "this many or more", so
 *  a 6-bedroom listing matches a "5" selection (chips are ['1'..'5']). */
export const BEDROOM_MAX = 5;

/** Does ONE listing satisfy ALL active listing-level filters at once?
 *  (Combined, not per-category — a single home must match the chosen price
 *  tier AND home type AND bedroom count.) Shared by the community matcher
 *  and the detail-panel listing filter so they can never disagree. */
export function listingMatchesActiveFilters(l) {
  if (state.priceTiers.size) {
    const tier = priceToTier(l.price);
    if (!tier || !state.priceTiers.has(tier)) return false;
  }
  if (state.homeTypes.size) {
    const mapped = isLandListing(l) ? 'Land' : mapListingHomeType(l.homeType);
    if (!mapped || !state.homeTypes.has(mapped)) return false;
  }
  if (state.bedrooms.size) {
    if (l.beds == null) return false;
    // Clamp to the top chip so "5" includes 5, 6, 7+ bedrooms.
    if (!state.bedrooms.has(String(Math.min(l.beds, BEDROOM_MAX)))) return false;
  }
  return true;
}

export function matches(c) {
  if (state.type !== 'all' && c.type !== state.type) return false;
  if (state.locations.size && !state.locations.has(c.location)) return false;
  if (state.waterfronts.size && !c.waterfront.some((w) => state.waterfronts.has(w))) return false;

  // Listing-level filters (price / beds / home type).
  //  - 'Currently for sale' ON: the community must have at least one active
  //    listing matching ALL active listing-level filters combined. No match
  //    (or no active homes) → excluded.
  //  - 'Currently for sale' OFF: the community qualifies through EITHER a
  //    matching active listing (same single-listing rule as ON) OR its
  //    broader community-level tags (historic price band / home types /
  //    bedrooms) — so inventory-less communities stay browsable, but the
  //    filters still filter. (An earlier rule blanket-included every
  //    community with any active listing here, which made these facets
  //    no-ops with the toggle off and contradicted the option counts.)
  if (hasListingLevelFilters()) {
    const items = c.activeListings?.items;
    const listingHit =
      Array.isArray(items) && items.length > 0 && items.some(listingMatchesActiveFilters);
    if (state.hasListingsOnly) {
      if (!listingHit) return false;
    } else if (!listingHit) {
      if (state.priceTiers.size && !c.priceTiers.some((t) => state.priceTiers.has(t))) return false;
      if (state.homeTypes.size && !c.homeTypes.some((t) => state.homeTypes.has(t))) return false;
      if (state.bedrooms.size && !c.bedTags.some((t) => state.bedrooms.has(t))) return false;
    }
  }
  // Amenities use AND: a community must have every checked amenity.
  // All other multi-select filters are OR (a property can only be in one
  // zone, but can legitimately match any of several selected price tiers,
  // home types, bedrooms, or waterfront types).
  if (state.amenities.size) {
    for (const a of state.amenities) if (!c.amenities.includes(a)) return false;
  }
  if (state.age55 && !c.is55plus) return false;
  // 'Currently for sale' filter — defaults on. Until the Wix sync lands,
  // every community has hasListings:true, so this is a no-op that starts
  // doing work as soon as listings data is populated.
  if (state.hasListingsOnly && !c.hasListings) return false;
  return true;
}

export function priceSortValue(c) {
  if (!c.priceTiers.length) return 99;
  return Math.min(...c.priceTiers.map((t) => PRICE_ORDER[t] ?? 99));
}

/**
 * @param {Array<object>} communities
 * @returns {Array<object>}
 */
export function getFiltered(communities) {
  let list = communities.filter(matches);
  if (state.sort === 'price-asc') list.sort((a, b) => priceSortValue(a) - priceSortValue(b));
  else if (state.sort === 'price-desc') list.sort((a, b) => priceSortValue(b) - priceSortValue(a));
  else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}
