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
  'Beach Club Access',
  'Walk to Beach',
  'Off-water',
];

export const PRICE_TIERS = [
  'Under $500K',
  '$500K–$1M',
  '$1M–$2M',
  '$2M–$5M',
  '$5M+',
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
      if (stateSet.has(opt)) stateSet.delete(opt);
      else stateSet.add(opt);
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
      if (state.priceTiers.has(tier)) state.priceTiers.delete(tier);
      else state.priceTiers.add(tier);
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

  // Amenities — sort by frequency (most common first), per CLAUDE.md.
  const homeTypeOptions = Object.keys(homeTypeCounts).sort((a, b) =>
    a.localeCompare(b)
  );
  const amenityOptions = Object.keys(amenityCounts).sort(
    (a, b) => (amenityCounts[b] || 0) - (amenityCounts[a] || 0)
  );

  renderChecklist('locationList', LOCATION_OPTIONS, locationCounts, state.locations, onChange);
  renderChecklist('waterfrontList', WATERFRONT_OPTIONS, waterfrontCounts, state.waterfronts, onChange);
  renderChecklist('homeTypeList', homeTypeOptions, homeTypeCounts, state.homeTypes, onChange);
  renderChecklist('amenityList', amenityOptions, amenityCounts, state.amenities, onChange);
  renderPriceChips(priceTierCounts, onChange);
  renderChips('bedroomList', BEDROOM_OPTIONS, bedCounts, state.bedrooms, onChange);
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

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    apply();
  });

  // Layout toggle
  document.querySelectorAll('.view-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.layout = btn.dataset.layout;
      setLayout(state.layout);
    });
  });
}
