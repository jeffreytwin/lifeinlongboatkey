/**
 * Community details panel — renders one selected community into the side
 * panel and toggles panel open/closed.
 *
 * Superseded the multi-card list grid: the list pane is now a "details on
 * demand" surface that opens when the user clicks a pin/polygon/zone bubble
 * and closes via the X button in the panel header.
 */

import { locationLabel, escapeHtml, youtubeEmbedUrl } from './utils.js';
import { AMENITY_ICONS, filteredAmenities, homesForSaleUrl } from './amenityIcons.js';
import { galleryHtml, wireGallery } from './gallery.js';
import { state } from './state.js';

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
    </div>`;

  wireGallery(el);

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
