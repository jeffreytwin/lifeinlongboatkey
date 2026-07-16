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
   * Community-cluster filter seeded by a full-map ?group= visit (e.g. the
   * "Bay Isles" email button): { slug, label, match }. Behaves like any
   * other criterion — shown as a dismissible chip in the filter rail and
   * released by Clear All — unlike the embed's hard working-set scoping,
   * which is invisible to the filter machinery on purpose (the Bay Isles
   * page's embed should stay Bay Isles).
   * @type {{ slug: string, label: string, match: (c: object) => boolean }|null}
   */
  group: null,
  /**
   * When true, hides communities with no homes/condos currently for sale.
   * Defaults to ON so prospective buyers see only actionable inventory.
   * Until the Wix CMS is wired up, every community is flagged
   * `hasListings: true`, so this filter is a no-op — but the toggle is
   * in place and will start doing real work the moment the sync lands.
   */
  hasListingsOnly: true,
  /**
   * 'map' (default): panel closed, map fills the content area.
   * 'detail': panel open showing the selected community's details.
   */
  layout: 'map',
  /**
   * Mobile-only. 'map' shows the interactive map; 'list' replaces it
   * with a scrollable list of community cards. Toggled via the Map/List
   * segmented control on mobile. Desktop ignores this.
   */
  view: 'map',
  /** @type {"default"|"name"|"price-asc"|"price-desc"} */
  sort: 'name',
  /** @type {string|null} */
  highlightedName: null,
  /**
   * Name of a deep-linked (?community=) community allowed to render on the
   * map even when the active filters exclude it — most commonly the default
   * 'Currently for sale' toggle hiding a community with no active listings.
   * Map-only: result counts and the list stay strictly filtered. Lapses when
   * the highlight moves to another community (see highlight() in main.js).
   * @type {string|null}
   */
  focusException: null,
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
  state.hasListingsOnly = true;
  state.group = null;
}
