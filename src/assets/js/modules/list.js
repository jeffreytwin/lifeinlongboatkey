/**
 * Community card list — rendering + card↔pin sync.
 *
 * Ported from docs/longboat-key-map-mockup.html lines 960–1016.
 */

import { getFiltered } from './matches.js';
import { locationLabel, escapeHtml } from './utils.js';

/**
 * @typedef {Object} ListCallbacks
 * @property {(name: string|null, opts?: {scroll?: boolean}) => void} onHighlight
 * @property {(community: object) => void} onCardClick
 */

/**
 * Render the card grid for the currently filtered set. Returns the filtered
 * list so callers (map.js) can use the same list to update markers.
 *
 * @param {Array<object>} communities
 * @param {ListCallbacks} callbacks
 * @returns {Array<object>}
 */
export function renderList(communities, callbacks) {
  const list = getFiltered(communities);
  const grid = document.getElementById('cardGrid');
  const countLabel = document.getElementById('listCountLabel');
  if (!grid || !countLabel) return list;

  countLabel.textContent = `${list.length} Match${list.length === 1 ? '' : 'es'}`;

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h4>No matches.</h4>
        <p>Try clearing a filter or widening your price range.</p>
      </div>`;
    return list;
  }

  grid.innerHTML = list
    .map((c) => {
      const wfBadges = c.waterfront
        .map((w) => {
          const cls = w === 'Gulf-front' ? 'wf-gulf' : w === 'Bay-front' ? 'wf-bay' : '';
          return `<span class="amenity-chip ${cls}">${escapeHtml(w)}</span>`;
        })
        .join('');
      const ageTag = c.is55plus ? `<span class="amenity-chip is-55">55+</span>` : '';
      const topAmenities = c.amenities
        .slice(0, 4)
        .map((a) => `<span class="amenity-chip">${escapeHtml(a)}</span>`)
        .join('');
      return `
      <div class="card" role="listitem" data-name="${escapeHtml(c.name)}">
        <div class="card-top">
          <div class="card-name">${escapeHtml(c.name)}</div>
          <span class="card-type-tag ${c.type === 'condo' ? 'tag-condo' : 'tag-nbhd'}">
            ${c.type === 'condo' ? 'Condo' : 'Neighborhood'}
          </span>
        </div>
        <div class="card-sub">${escapeHtml(c.subtitle || '')}</div>
        <div class="card-price">${escapeHtml(c.priceRange || '—')}</div>
        <div class="card-meta">
          <span class="meta"><span class="meta-label">Location</span><span class="meta-val">${escapeHtml(locationLabel(c.location))}</span></span>
          ${c.bedrooms ? `<span class="meta"><span class="meta-label">Beds</span><span class="meta-val">${escapeHtml(c.bedrooms)}</span></span>` : ''}
          ${c.sqft ? `<span class="meta"><span class="meta-label">Sq Ft</span><span class="meta-val">${escapeHtml(c.sqft)}</span></span>` : ''}
        </div>
        <div class="card-amenities">${wfBadges}${ageTag}${topAmenities}</div>
      </div>`;
    })
    .join('');

  // Wire card hover + click events
  grid.querySelectorAll('.card').forEach((card) => {
    const name = card.dataset.name;
    card.addEventListener('mouseenter', () => callbacks.onHighlight(name, { scroll: false }));
    card.addEventListener('mouseleave', () => callbacks.onHighlight(null, { scroll: false }));
    card.addEventListener('click', () => {
      const c = communities.find((x) => x.name === name);
      if (c) callbacks.onCardClick(c);
    });
  });

  return list;
}

/**
 * Toggle the .highlighted class on a single card by name.
 * Pin highlighting is handled by map.js on its own marker elements.
 */
export function setHighlightedCard(name) {
  document.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('highlighted', card.dataset.name === name);
  });
}
