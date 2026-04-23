/**
 * Community details panel — renders one selected community into the side
 * panel and toggles panel open/closed.
 *
 * Superseded the multi-card list grid: the list pane is now a "details on
 * demand" surface that opens when the user clicks a pin/polygon/zone bubble
 * and closes via the X button in the panel header.
 */

import { locationLabel, escapeHtml, communityPhotoUrl, youtubeEmbedUrl } from './utils.js';
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

  const wfBadges = (community.waterfront || [])
    .map((w) => {
      const cls = w === 'Gulf-front' ? 'wf-gulf' : w === 'Bay-front' ? 'wf-bay' : '';
      return `<span class="amenity-chip ${cls}">${escapeHtml(w)}</span>`;
    })
    .join('');
  const ageTag = community.is55plus ? `<span class="amenity-chip is-55">55+</span>` : '';
  const amenities = (community.amenities || [])
    .map((a) => `<span class="amenity-chip">${escapeHtml(a)}</span>`)
    .join('');

  el.innerHTML = `
    <div class="detail-photo ${community.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
      <img src="${escapeHtml(communityPhotoUrl(community))}" alt="" />
    </div>
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
      <div class="detail-meta">
        ${community.bedrooms ? `<div class="meta"><span class="meta-label">Bedrooms</span><span class="meta-val">${escapeHtml(community.bedrooms)}</span></div>` : ''}
        ${community.sqft ? `<div class="meta"><span class="meta-label">Sq Ft</span><span class="meta-val">${escapeHtml(community.sqft)}</span></div>` : ''}
      </div>
      ${community.shortDescription ? `<p class="detail-desc">${escapeHtml(community.shortDescription)}</p>` : ''}
      <div class="detail-chips">${wfBadges}${ageTag}${amenities}</div>
      <a class="detail-link" href="https://www.lifeinlongboatkey.com${escapeHtml(community.pageUrl || '')}" target="_blank" rel="noopener">
        View community page →
      </a>
    </div>`;

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
