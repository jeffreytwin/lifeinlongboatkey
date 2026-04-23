/**
 * Filter panel rendering + wiring.
 *
 * Builds every checklist/chip group, computes option counts, and wires event
 * handlers that mutate the shared state then trigger a full re-apply.
 *
 * Ported from docs/longboat-key-map-mockup.html lines 618–726.
 */

import { state, resetFilters } from './state.js';
import { countsBy, escapeHtml } from './utils.js';

export const LOCATION_OPTIONS = [
  { key: 'north', label: 'North End' },
  { key: 'mid', label: 'Mid-Key' },
  { key: 'south', label: 'South End' },
];

export const WATERFRONT_OPTIONS = [
  'Gulf-front',
  'Bay-front',
];

/**
 * Amenities hidden from the filter panel entirely. Records may still carry
 * these values in their `amenities` array — we just don't offer them as
 * filter options. Hiding is a UI concern only; matching logic is untouched.
 */
const AMENITIES_HIDDEN = new Set([
  'Private Beach (Deeded)',
  'Beach-Club Access',
  'Beach Club Access', // also filter out the without-hyphen variant
]);

/**
 * Custom ordering for the Amenities filter. Amenities appear in the listed
 * order first; anything else falls through to a frequency sort after them.
 */
const AMENITIES_PRIORITY = [
  'Gated',
  'Beach Access',
  'Private Beach',
  'Marina Access',
  'Personal Boat Slips',
  'Tennis',
  'Pickleball',
  'Golf',
];

export const PRICE_TIERS = [
  'Under $500K',
  '$500K–$1M',
  '$1M–$2M',
  '$2M–$5M',
  '$5M–$10M',
  '$10M–$15M',
  '$15M+',
];

export const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5'];

/**
 * Render a checklist filter (e.g. Location, Waterfront, Home Type, Amenities).
 *
 * @param {string} containerId
 * @param {Array<string|{key:string,label:string}>} options
 * @param {Record<string, number>} counts
 * @param {Set<string>} stateSet
 * @param {() => void} onChange
 */
function renderChecklist(containerId, options, counts, stateSet, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  options.forEach((opt) => {
    const key = typeof opt === 'string' ? opt : opt.key;
    const label = typeof opt === 'string' ? opt : opt.label;
    const count = counts[key] || 0;
    const item = document.createElement('label');
    item.className = 'checklist-item' + (count === 0 ? ' is-zero' : '');
    item.innerHTML = `
      <input type="checkbox" ${stateSet.has(key) ? 'checked' : ''} />
      <span class="label">${escapeHtml(label)}</span>
      <span class="count">${count}</span>
    `;
    const input = item.querySelector('input');
    input.addEventListener('change', () => {
      if (input.checked) stateSet.add(key);
      else stateSet.delete(key);
      onChange();
    });
    el.appendChild(item);
  });
}

/**
 * Render a chip filter (Bedrooms).
 *
 * @param {string} containerId
 * @param {Array<string>} options
 * @param {Record<string, number>} counts
 * @param {Set<string>} stateSet
 * @param {() => void} onChange
 */
function renderChips(containerId, options, counts, stateSet, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  options.forEach((opt) => {
    const count = counts[opt] || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'chip' +
      (stateSet.has(opt) ? ' active' : '') +
      (count === 0 ? ' is-zero' : '');
    btn.innerHTML = `${escapeHtml(opt)}<span class="count">${count}</span>`;
    btn.addEventListener('click', () => {
      if (count === 0) return;
      const nowActive = !stateSet.has(opt);
      if (nowActive) stateSet.add(opt);
      else stateSet.delete(opt);
      btn.classList.toggle('active', nowActive);
      onChange();
    });
    el.appendChild(btn);
  });
}

/**
 * Render the price-tier chips.
 */
function renderPriceChips(counts, onChange) {
  const el = document.getElementById('priceList');
  if (!el) return;
  el.innerHTML = '';
  PRICE_TIERS.forEach((tier) => {
    const count = counts[tier] || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'chip' +
      (state.priceTiers.has(tier) ? ' active' : '') +
      (count === 0 ? ' is-zero' : '');
    btn.innerHTML = `${escapeHtml(tier)}<span class="count">${count}</span>`;
    btn.addEventListener('click', () => {
      if (count === 0) return;
      const nowActive = !state.priceTiers.has(tier);
      if (nowActive) state.priceTiers.add(tier);
      else state.priceTiers.delete(tier);
      btn.classList.toggle('active', nowActive);
      onChange();
    });
    el.appendChild(btn);
  });
}

/**
 * Full filter render. Recomputes counts from the full community set
 * (not the filtered set) so filters never show 0 for options that still
 * exist in the dataset when something else is selected.
 *
 * @param {Array<object>} communities
 * @param {() => void} onChange
 */
export function renderFilters(communities, onChange) {
  const locationCounts = countsBy(communities, 'location');
  const waterfrontCounts = countsBy(communities, 'waterfront', true);
  const homeTypeCounts = countsBy(communities, 'homeTypes', true);
  const amenityCounts = countsBy(communities, 'amenities', true);
  const priceTierCounts = countsBy(communities, 'priceTiers', true);
  const bedCounts = countsBy(communities, 'bedTags', true);

  const homeTypeOptions = Object.keys(homeTypeCounts).sort((a, b) =>
    a.localeCompare(b)
  );
  // Amenities: user-defined priority order first, then frequency for the
  // remainder. Hidden amenities are dropped from the filter list entirely.
  const priorityIndex = new Map(AMENITIES_PRIORITY.map((a, i) => [a, i]));
  const amenityOptions = Object.keys(amenityCounts)
    .filter((a) => !AMENITIES_HIDDEN.has(a))
    .sort((a, b) => {
      const ai = priorityIndex.has(a) ? priorityIndex.get(a) : Infinity;
      const bi = priorityIndex.has(b) ? priorityIndex.get(b) : Infinity;
      if (ai !== bi) return ai - bi;
      return (amenityCounts[b] || 0) - (amenityCounts[a] || 0);
    });

  // Location on Island — bundles the zone options (north/mid/south) and
  // waterfront options (Gulf-front/Bay-front) into a single checklist. Each
  // option internally toggles its matching state Set.
  renderLocationFilter(locationCounts, waterfrontCounts, onChange);
  renderChecklist('homeTypeList', homeTypeOptions, homeTypeCounts, state.homeTypes, onChange);
  renderChecklist('amenityList', amenityOptions, amenityCounts, state.amenities, onChange);
  renderPriceChips(priceTierCounts, onChange);
  renderChips('bedroomList', BEDROOM_OPTIONS, bedCounts, state.bedrooms, onChange);
}

function renderLocationFilter(locationCounts, waterfrontCounts, onChange) {
  const el = document.getElementById('locationList');
  if (!el) return;
  el.innerHTML = '';
  const items = [
    ...LOCATION_OPTIONS.map((opt) => ({
      key: opt.key,
      label: opt.label,
      count: locationCounts[opt.key] || 0,
      set: state.locations,
    })),
    {
      key: 'Gulf-front',
      label: 'Gulf-front',
      count: waterfrontCounts['Gulf-front'] || 0,
      set: state.waterfronts,
    },
    {
      key: 'Bay-front',
      label: 'Bay-front',
      count: waterfrontCounts['Bay-front'] || 0,
      set: state.waterfronts,
    },
  ];
  items.forEach(({ key, label, count, set }) => {
    const item = document.createElement('label');
    item.className = 'checklist-item' + (count === 0 ? ' is-zero' : '');
    item.innerHTML = `
      <input type="checkbox" ${set.has(key) ? 'checked' : ''} />
      <span class="label">${escapeHtml(label)}</span>
      <span class="count">${count}</span>
    `;
    const input = item.querySelector('input');
    input.addEventListener('change', () => {
      if (input.checked) set.add(key);
      else set.delete(key);
      onChange();
    });
    el.appendChild(item);
  });
}

/**
 * Wire up the controls that live outside the render loop — type pills,
 * 55+ toggle, Clear All, sort, and layout toggle.
 *
 * @param {Array<object>} communities
 * @param {{ apply: () => void, setLayout: (layout: string) => void }} callbacks
 */
export function setupStaticControls(communities, { apply, setLayout }) {
  // Type pills
  document.querySelectorAll('.type-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.type-pill').forEach((p) => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-checked', 'true');
      state.type = pill.dataset.type;
      apply();
    });
  });

  // 55+ toggle
  const age55 = document.getElementById('age55Toggle');
  age55?.addEventListener('click', () => {
    state.age55 = !state.age55;
    age55.setAttribute('aria-pressed', state.age55 ? 'true' : 'false');
    apply();
  });

  // Clear all
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    resetFilters();
    document.querySelectorAll('.type-pill').forEach((p) => {
      const isAll = p.dataset.type === 'all';
      p.classList.toggle('active', isAll);
      p.setAttribute('aria-checked', isAll ? 'true' : 'false');
    });
    age55?.setAttribute('aria-pressed', 'false');
    renderFilters(communities, apply);
    apply();
  });

  // Sort control lived in the old list header (now the details panel);
  // its <select> is gone. Ignore missing element silently.
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    apply();
  });

  // Layout toggle removed — layout is now controlled programmatically
  // (map by default, detail when a community is selected, back to map
  // via the panel's close button). setLayout is retained as a no-op
  // invalidate for back-compat.
  void setLayout;
}
