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

/** Given a listing's homeType and the community's homeTypes array,
 *  return the community-level label that matches (or null). Used so the
 *  filter and chip counts share a consistent vocabulary even when the
 *  listing field uses singular / different-casing values
 *  (e.g. listing "Condominium" maps to community "Condominiums"). */
export function mapListingHomeType(listingType, communityTypes) {
  const lt = normHomeType(listingType);
  if (!lt || !Array.isArray(communityTypes)) return null;
  for (const ct of communityTypes) {
    if (normHomeType(ct) === lt) return ct;
  }
  // Fall back to a loose substring match for slight wording drift.
  for (const ct of communityTypes) {
    const ctn = normHomeType(ct);
    if (ctn && (ctn.startsWith(lt) || lt.startsWith(ctn))) return ct;
  }
  return null;
}

export function matches(c) {
  if (state.type !== 'all' && c.type !== state.type) return false;
  if (state.locations.size && !state.locations.has(c.location)) return false;
  if (state.waterfronts.size && !c.waterfront.some((w) => state.waterfronts.has(w))) return false;
  // Price tiers — when 'Currently for sale' is on AND we have per-listing
  // detail, bucket each listing's numeric price into a tier and match.
  // Falls back to the community's broader priceTiers otherwise.
  if (state.priceTiers.size) {
    const items = c.activeListings?.items;
    if (state.hasListingsOnly && Array.isArray(items) && items.length) {
      const ok = items.some((it) => {
        const tier = priceToTier(it.price);
        return tier && state.priceTiers.has(tier);
      });
      if (!ok) return false;
    } else if (!c.priceTiers.some((t) => state.priceTiers.has(t))) {
      return false;
    }
  }
  // Home types — same listings-aware pattern. Listings' homeType field
  // tends to be singular ("Condominium") where the community is plural
  // ("Condominiums"); mapListingHomeType bridges the two vocabularies.
  if (state.homeTypes.size) {
    const items = c.activeListings?.items;
    if (state.hasListingsOnly && Array.isArray(items) && items.length) {
      const ok = items.some((it) => {
        const mapped = mapListingHomeType(it.homeType, c.homeTypes);
        return mapped && state.homeTypes.has(mapped);
      });
      if (!ok) return false;
    } else if (!c.homeTypes.some((t) => state.homeTypes.has(t))) {
      return false;
    }
  }
  // Bedrooms — when 'Currently for sale' is on AND we have per-listing
  // detail, match against the actual active listings' bedroom counts
  // rather than the community's broader bedroomRange. Otherwise the
  // filter says "match this community because some 4-bed home exists
  // here" but the panel only shows a 3-bed listing.
  if (state.bedrooms.size) {
    const items = c.activeListings?.items;
    if (state.hasListingsOnly && Array.isArray(items) && items.length) {
      const ok = items.some((it) => it.beds != null && state.bedrooms.has(String(it.beds)));
      if (!ok) return false;
    } else if (!c.bedTags.some((t) => state.bedrooms.has(t))) {
      return false;
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
