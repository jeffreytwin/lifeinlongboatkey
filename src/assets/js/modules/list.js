/**
 * Community details panel — renders one selected community into the side
 * panel and toggles panel open/closed.
 *
 * Superseded the multi-card list grid: the list pane is now a "details on
 * demand" surface that opens when the user clicks a pin/polygon/zone bubble
 * and closes via the X button in the panel header.
 */

import { locationLabel, escapeHtml, communityPhotoUrl, youtubeEmbedUrl, staticMapUrl } from './utils.js';
import { AMENITY_ICONS, filteredAmenities } from './amenityIcons.js';
import { galleryHtml, wireGallery } from './gallery.js';
import { state } from './state.js';

/** Callback passed from main.js for list-item clicks. */
let onListItemClick = () => {};
export function setListItemClickHandler(fn) { onListItemClick = fn; }

/** Callback passed from main.js for clicking the reference map at the
 *  bottom of the details panel (desktop only — mobile doesn't wire it). */
let onLocateOnMap = () => {};
export function setLocateOnMapHandler(fn) { onLocateOnMap = fn; }

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
    .map((c) => {
      const priceRange = c.activeListings?.priceRange || c.priceRange || '—';
      return `
      <li class="list-view-item" data-name="${escapeHtml(c.name)}">
        <div class="list-view-photo ${c.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
          <img src="${escapeHtml(communityPhotoUrl(c))}" alt="" loading="lazy" />
        </div>
        <div class="list-view-body">
          <div class="list-view-meta">
            ${c.type === 'condo' ? 'Condominiums' : 'Neighborhood'} · ${escapeHtml(locationLabel(c.location))}
          </div>
          <div class="list-view-name">${escapeHtml(c.name)}</div>
          <div class="list-view-price">${escapeHtml(priceRange)}</div>
        </div>
      </li>`;
    })
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
 * Render the active-listings section (price card grid) that sits beneath
 * the location map in the detail panel. Returns '' when there's nothing
 * to render so the panel skips the section entirely.
 */
function renderListings(community) {
  const items = community.activeListings?.items;
  if (!Array.isArray(items) || items.length === 0) return '';
  const baseHost = 'https://www.lifeinlongboatkey.com';
  const count = community.activeListings.count || items.length;
  const heading = `${count} Home${count === 1 ? '' : 's'} for Sale`;
  const cards = items
    .map((l) => {
      const href = l.url
        ? (/^https?:/.test(l.url) ? l.url : baseHost + l.url)
        : null;
      const photo = l.image
        ? `<div class="listing-card-photo"><img src="${escapeHtml(l.image)}" alt="" loading="lazy" /></div>`
        : '<div class="listing-card-photo listing-card-photo-empty" aria-hidden="true"></div>';
      const metaBits = [
        l.beds != null ? `${l.beds} bd` : null,
        l.baths != null ? `${l.baths} ba` : null,
        l.sqftText ? `${escapeHtml(l.sqftText)} sqft` : null,
      ].filter(Boolean);
      const meta = metaBits.length
        ? `<div class="listing-card-meta">${metaBits.join(' · ')}</div>`
        : '';
      const sub = [
        l.homeType ? escapeHtml(l.homeType) : null,
        l.garage ? `${escapeHtml(l.garage)} garage` : null,
      ].filter(Boolean).join(' · ');
      const inner = `
        ${photo}
        <div class="listing-card-body">
          ${l.priceText ? `<div class="listing-card-price">${escapeHtml(l.priceText)}</div>` : ''}
          ${l.address ? `<div class="listing-card-address">${escapeHtml(l.address)}</div>` : ''}
          ${meta}
          ${sub ? `<div class="listing-card-sub">${sub}</div>` : ''}
        </div>`;
      return `<li class="listing-card">${
        href
          ? `<a class="listing-card-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">${inner}</a>`
          : inner
      }</li>`;
    })
    .join('');
  return `
    <section class="detail-listings" id="detail-listings" aria-label="Homes for sale">
      <div class="detail-listings-label">${escapeHtml(heading)}</div>
      <ul class="listing-grid">${cards}</ul>
    </section>`;
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
      const iconHtml = icon
        ? `<img class="amenity-icon" src="${escapeHtml(icon)}" alt="" loading="lazy" />`
        : '<span class="amenity-icon amenity-icon-empty" aria-hidden="true"></span>';
      return `<div class="amenity-item">
        ${iconHtml}
        <span class="amenity-label">${escapeHtml(a)}</span>
      </div>`;
    })
    .join('');

  const page = community.pageUrl || '';
  const baseHost = 'https://www.lifeinlongboatkey.com';

  // Prefer live for-sale ranges when active listings exist; fall back to
  // the static Wix-curated priceRange/bedrooms/sqft otherwise.
  const active = community.activeListings;
  const priceRange = active?.priceRange || community.priceRange;
  const bedrooms   = active?.bedrooms   || community.bedrooms;
  const sqft       = active?.sqft       || community.sqft;
  const listingsCount = active?.count || 0;
  const homesCta = listingsCount === 1
    ? 'View (1) Home for Sale'
    : `View (${listingsCount}) Homes for Sale`;

  el.innerHTML = `
    ${galleryHtml(community)}
    <div class="detail-body">
      <div class="detail-type-tag ${community.type === 'condo' ? 'tag-condo' : 'tag-nbhd'}">
        ${community.type === 'condo' ? 'Condo' : 'Neighborhood'} · ${escapeHtml(locationLabel(community.location))}
      </div>
      <h2 class="detail-name">${escapeHtml(community.name)}</h2>
      ${community.subtitle ? `<div class="detail-sub">${escapeHtml(community.subtitle)}</div>` : ''}
      <div class="detail-price">${escapeHtml(priceRange || '—')}</div>
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
        ${community.hasListings ? `
          <button type="button" class="detail-link detail-link-primary" data-scroll-to="detail-listings">
            ${escapeHtml(homesCta)}
          </button>
          <a class="detail-link detail-link-secondary" href="${escapeHtml(baseHost + page)}" target="_blank" rel="noopener">
            View<br>Community Page
          </a>
        ` : `
          <a class="detail-link detail-link-primary" href="${escapeHtml(baseHost + page)}" target="_blank" rel="noopener">
            View<br>Community Page
          </a>
        `}
      </div>
      <div class="detail-meta">
        ${bedrooms ? `<div class="meta"><span class="meta-label">Bedrooms</span><span class="meta-val">${escapeHtml(bedrooms)}</span></div>` : ''}
        ${sqft ? `<div class="meta"><span class="meta-label">Sq Ft</span><span class="meta-val">${escapeHtml(sqft)}</span></div>` : ''}
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
      ${renderListings(community)}
    </div>`;

  wireGallery(el);

  // Reference-map click — flies the main map to this community's
  // location. On mobile the onLocateOnMap handler also switches to
  // the map view if the user is currently in list view, so it works
  // on every device.
  const mapEl = el.querySelector('.detail-map');
  if (mapEl) {
    mapEl.classList.add('is-clickable');
    mapEl.addEventListener('click', () => onLocateOnMap(community));
  }

  // "View (N) Homes for Sale" scrolls the panel down to the listings
  // section rather than navigating off-site.
  el.querySelector('[data-scroll-to]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.scrollTo;
    el.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

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
