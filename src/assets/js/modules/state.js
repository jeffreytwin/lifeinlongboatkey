/**
 * Centralized state for the interactive map.
 *
 * Matches the shape used by the mockup (docs/longboat-key-map-mockup.html
 * lines 604–616) so the filter/list logic ports cleanly. Parrish uses a
 * getter/setter module pattern; we follow the same idea but expose the state
 * object directly because every consumer mutates Sets in place.
 */

export const state = {
  /** @type {"all"|"neighborhood"|"condo"} */
  type: 'all',
  /** @type {Set<string>} */
  locations: new Set(),
  /** @type {Set<string>} */
  waterfronts: new Set(),
  /** @type {Set<string>} */
  priceTiers: new Set(),
  /** @type {Set<string>} */
  homeTypes: new Set(),
  /** @type {Set<string>} */
  bedrooms: new Set(),
  /** @type {Set<string>} */
  amenities: new Set(),
  /** @type {boolean} */
  age55: false,
  /**
   * 'map' (default): panel closed, map fills the content area.
   * 'detail': panel open showing the selected community's details.
   */
  layout: 'map',
  /** @type {"default"|"name"|"price-asc"|"price-desc"} */
  sort: 'default',
  /** @type {string|null} */
  highlightedName: null,
  /** @type {object|null} — the community currently shown in the details panel */
  selectedCommunity: null,
};

export function resetFilters() {
  state.type = 'all';
  state.locations.clear();
  state.waterfronts.clear();
  state.priceTiers.clear();
  state.homeTypes.clear();
  state.bedrooms.clear();
  state.amenities.clear();
  state.age55 = false;
}
