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
  '$5M+': 4,
};

export function matches(c) {
  if (state.type !== 'all' && c.type !== state.type) return false;
  if (state.locations.size && !state.locations.has(c.location)) return false;
  if (state.waterfronts.size && !c.waterfront.some((w) => state.waterfronts.has(w))) return false;
  if (state.priceTiers.size && !c.priceTiers.some((t) => state.priceTiers.has(t))) return false;
  if (state.homeTypes.size && !c.homeTypes.some((t) => state.homeTypes.has(t))) return false;
  if (state.bedrooms.size && !c.bedTags.some((t) => state.bedrooms.has(t))) return false;
  // Amenities use AND: a community must have every checked amenity.
  // All other multi-select filters are OR (a property can only be in one
  // zone, but can legitimately match any of several selected price tiers,
  // home types, bedrooms, or waterfront types).
  if (state.amenities.size) {
    for (const a of state.amenities) if (!c.amenities.includes(a)) return false;
  }
  if (state.age55 && !c.is55plus) return false;
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
