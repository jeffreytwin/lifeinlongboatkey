/**
 * Session persistence for the filter state.
 *
 * Clicking a listing navigates the (top) page away; when the visitor comes
 * back, the browser's back/forward cache usually restores the app exactly
 * as they left it — but bfcache isn't guaranteed, and a miss reloads the
 * app fresh. This module makes filter memory deterministic: the state is
 * saved to sessionStorage on every apply and restored at boot.
 *
 * Keyed by pathname + search, so each embed variant (?embed=bay-isles,
 * ?embed=1&community=…) and the standalone map remember their own state
 * without bleeding into each other. sessionStorage is per-tab and dies
 * with it, so this is "memory within a visit," not tracking.
 */

import { state } from './state.js';

const key = () => `lbk-filters:${location.pathname}${location.search}`;

export function saveFilterState() {
  try {
    sessionStorage.setItem(
      key(),
      JSON.stringify({
        type: state.type,
        locations: [...state.locations],
        waterfronts: [...state.waterfronts],
        priceTiers: [...state.priceTiers],
        homeTypes: [...state.homeTypes],
        bedrooms: [...state.bedrooms],
        amenities: [...state.amenities],
        age55: state.age55,
        hasListingsOnly: state.hasListingsOnly,
        sort: state.sort,
        view: state.view === 'list' ? 'list' : 'map',
      }),
    );
  } catch (_) {
    /* storage unavailable (private mode etc.) — memory then rides on bfcache */
  }
}

/**
 * Restore a previously saved state into the live state object.
 * @returns {{ view: string }|null} the saved snapshot, or null when there
 *   was nothing (or nothing usable) to restore.
 */
export function restoreFilterState() {
  try {
    const raw = sessionStorage.getItem(key());
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    state.type = s.type === 'neighborhood' || s.type === 'condo' ? s.type : 'all';
    state.locations = new Set(s.locations || []);
    state.waterfronts = new Set(s.waterfronts || []);
    state.priceTiers = new Set(s.priceTiers || []);
    state.homeTypes = new Set(s.homeTypes || []);
    state.bedrooms = new Set(s.bedrooms || []);
    state.amenities = new Set(s.amenities || []);
    state.age55 = !!s.age55;
    state.hasListingsOnly = s.hasListingsOnly !== false;
    state.sort = s.sort || state.sort;
    return s;
  } catch (_) {
    return null;
  }
}
