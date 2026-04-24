/**
 * Community details panel — renders one selected community into the side
 * panel and toggles panel open/closed.
 *
 * Superseded the multi-card list grid: the list pane is now a "details on
 * demand" surface that opens when the user clicks a pin/polygon/zone bubble
 * and closes via the X button in the panel header.
 */

import { locationLabel, escapeHtml, communityPhotoUrl, youtubeEmbedUrl, staticMapUrl } from './utils.js';
import { AMENITY_ICONS, filteredAmenities, homesForSaleUrl } from './amenityIcons.js';
import { galleryHtml, wireGallery } from './gallery.js';
import { state } from './state.js';

/** Callback passed from main.js for list-item clicks. */
let onListItemClick = () => {};
export function setListItemClickHandler(fn) { onListItemClick = fn; }

/** Callback passed from main.js for clicking the reference map at the
 *  bottom of the details panel (desktop only — mobile doesn't wire it). */
let onLocateOnMap = () => {};
export function setLocateOnMapHandler(fn) { onLocateOnMap = fn; }

/** Only wire the reference-map click on real pointer devices. */
const CAN_HOVER =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(hover: hover)').matches;

/**
 * Render the mobile list-view items for a filtered community set.
 * Safe to call even when the user isn't currently in list view — keeps
 * the DOM in sync so switching views is instant.
 */
export function renderMobileList(list) {
  const el = document.getElementById('listView');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<li class="list-view-empty">No communities match your filters.</li>`;
    return;
  }
  el.innerHTML = list
    .map((c) => `
      <li class="list-view-item" data-name="${escapeHtml(c.name)}">
        <div class="list-view-photo ${c.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
          <img src="${escapeHtml(communityPhotoUrl(c))}" alt="" loading="lazy" />
        </div>
        <div class="list-view-body">
          <div class="list-view-meta">
            ${c.type === 'condo' ? 'Condominiums' : 'Neighborhood'} · ${escapeHtml(locationLabel(c.location))}
          </div>
          <div class="list-view-name">${escapeHtml(c.name)}</div>
          <div class="list-view-price">${escapeHtml(c.priceRange || '—')}</div>
        </div>
      </li>`)
    .join('');
  el.querySelectorAll('.list-view-item').forEach((item) => {
    item.addEventListener('click', () => {
      const name = item.dataset.name;
      const c = list.find((x) => x.name === name);
      if (c) onListItemClick(c);
    });
  });
}

/**
 * Render the selected community into the detail panel and open it.
 *
 * @param {object} community
 */
export function showDetail(community) {
  state.selectedCommunity = community;
  const el = document.getElementById('detailContent');
  if (!el) return;

  // Waterfront + 55+ are classification badges, rendered separately from
  // amenities (which get the icon grid).
  const wfBadges = (community.waterfront || [])
    .filter((w) => w === 'Gulf-front' || w === 'Bay-front')
    .map((w) => {
      const cls = w === 'Gulf-front' ? 'wf-gulf' : 'wf-bay';
      return `<span class="amenity-chip ${cls}">${escapeHtml(w)}</span>`;
    })
    .join('');
  const ageTag = community.is55plus ? `<span class="amenity-chip is-55">55+</span>` : '';
  const classChips = wfBadges + ageTag;

  // Amenities — filtered to the standard set and rendered as icon + label.
  const amenityList = filteredAmenities(community.amenities);
  const amenitiesHtml = amenityList
    .map((a) => {
      const icon = AMENITY_ICONS[a];
      return `<div class="amenity-item">
        <img class="amenity-icon" src="${escapeHtml(icon)}" alt="" loading="lazy" />
        <span class="amenity-label">${escapeHtml(a)}</span>
      </div>`;
    })
    .join('');

  const page = community.pageUrl || '';
  const homes = homesForSaleUrl(page);
  const baseHost = 'https://www.lifeinlongboatkey.com';

  el.innerHTML = `
    ${galleryHtml(community)}
    <div class="detail-body">
      <div class="detail-type-tag ${community.type === 'condo' ? 'tag-condo' : 'tag-nbhd'}">
        ${community.type === 'condo' ? 'Condo' : 'Neighborhood'} · ${escapeHtml(locationLabel(community.location))}
      </div>
      <h2 class="detail-name">${escapeHtml(community.name)}</h2>
      ${community.subtitle ? `<div class="detail-sub">${escapeHtml(community.subtitle)}</div>` : ''}
      <div class="detail-price">${escapeHtml(community.priceRange || '—')}</div>
      ${(() => {
        const embed = youtubeEmbedUrl(community.youtubeUrl);
        if (!embed) return '';
        return `<div class="detail-video">
          <iframe src="${escapeHtml(embed)}"
                  title="${escapeHtml(community.name)} video"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>
        </div>`;
      })()}
      <div class="detail-actions">
        <a class="detail-link detail-link-primary" href="${escapeHtml(baseHost + homes)}" target="_blank" rel="noopener">
          View<br>Homes for Sale
        </a>
        <a class="detail-link detail-link-secondary" href="${escapeHtml(baseHost + page)}" target="_blank" rel="noopener">
          View<br>Community Page
        </a>
      </div>
      <div class="detail-meta">
        ${community.bedrooms ? `<div class="meta"><span class="meta-label">Bedrooms</span><span class="meta-val">${escapeHtml(community.bedrooms)}</span></div>` : ''}
        ${community.sqft ? `<div class="meta"><span class="meta-label">Sq Ft</span><span class="meta-val">${escapeHtml(community.sqft)}</span></div>` : ''}
      </div>
      ${amenitiesHtml ? `<div class="detail-amenities">${amenitiesHtml}</div>` : ''}
      ${community.shortDescription ? `<p class="detail-desc">${escapeHtml(community.shortDescription)}</p>` : ''}
      ${classChips ? `<div class="detail-chips">${classChips}</div>` : ''}
      ${(() => {
        const mapSrc = staticMapUrl(community);
        if (!mapSrc) return '';
        return `<div class="detail-map" aria-label="Map showing location">
          <div class="detail-map-label">Location on Longboat Key</div>
          <img src="${escapeHtml(mapSrc)}" alt="Map of ${escapeHtml(community.name)}" loading="lazy" />
        </div>`;
      })()}
    </div>`;

  wireGallery(el);

  // Reference-map click (desktop only) — flies the main map to this
  // community's location, switching to map view first if needed.
  if (CAN_HOVER) {
    const mapEl = el.querySelector('.detail-map');
    if (mapEl) {
      mapEl.classList.add('is-clickable');
      mapEl.addEventListener('click', () => onLocateOnMap(community));
    }
  }

  const content = document.getElementById('content');
  const panel = document.querySelector('.detail-panel');
  if (content) content.className = 'content layout-detail';
  if (panel) panel.setAttribute('aria-hidden', 'false');
  state.layout = 'detail';
}

/** Close the detail panel and return the map to full-width. */
export function hideDetail() {
  state.selectedCommunity = null;
  const content = document.getElementById('content');
  const panel = document.querySelector('.detail-panel');
  if (content) content.className = 'content layout-map';
  if (panel) panel.setAttribute('aria-hidden', 'true');
  state.layout = 'map';
}

/**
 * Kept as a no-op shim — callers (main.js) still call this after filter
 * changes. Nothing to render in the panel since we no longer show a list.
 */
export function renderList() {
  // intentionally empty
  return [];
}

/** No-op — retained for call-site compatibility with the old list module. */
export function setHighlightedCard() {
  // intentionally empty
}
