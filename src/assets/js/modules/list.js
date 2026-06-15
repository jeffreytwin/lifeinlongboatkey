/**
 * Community details panel — renders one selected community into the side
 * panel and toggles panel open/closed.
 *
 * Superseded the multi-card list grid: the list pane is now a "details on
 * demand" surface that opens when the user clicks a pin/polygon/zone bubble
 * and closes via the X button in the panel header.
 */

import { locationLabel, escapeHtml, communityThumbUrl, wixImageUrl, IMG_SIZES, youtubeEmbedUrl, staticMapUrl } from './utils.js';
import { AMENITY_ICONS, filteredAmenities } from './amenityIcons.js';
import { galleryHtml, wireGallery } from './gallery.js';
import { state } from './state.js';
import { hasListingLevelFilters, listingMatchesActiveFilters, isLandListing } from './matches.js';

/** Callback passed from main.js for list-item clicks. */
let onListItemClick = () => {};
export function setListItemClickHandler(fn) { onListItemClick = fn; }

/** Per-panel toggle: show every listing in the community, or just the ones
 *  matching the active filters. Reset to "matching" each time a community
 *  opens (see showDetail). */
let listingsShowAll = false;

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
      const priceRange = displayRange(c, 'priceRange') || '—';
      return `
      <li class="list-view-item" data-name="${escapeHtml(c.name)}">
        <div class="list-view-photo ${c.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
          <img src="${escapeHtml(communityThumbUrl(c))}" alt="" loading="lazy" decoding="async" />
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

/** Pick a display range (priceRange / bedrooms / sqft) for a community,
 *  honoring the 'Currently for sale' toggle: active-listing ranges when on,
 *  historic ranges when off — each falling back to the other when absent.
 *  Active lives on `community.activeListings.*`, historic on `community.*`. */
function displayRange(community, field) {
  const activeVal = community.activeListings?.[field];
  const historicVal = community[field];
  return state.hasListingsOnly ? (activeVal || historicVal) : (historicVal || activeVal);
}

/** Bedrooms + Sq Ft meta block for the detail panel (shared by the initial
 *  render and the live refresh so the two can't drift). */
function detailMetaHtml(community) {
  const bedrooms = displayRange(community, 'bedrooms');
  const sqft = displayRange(community, 'sqft');
  return `${bedrooms ? `<div class="meta"><span class="meta-label">Bedrooms</span><span class="meta-val">${escapeHtml(bedrooms)}</span></div>` : ''}${sqft ? `<div class="meta"><span class="meta-label">Sq Ft</span><span class="meta-val">${escapeHtml(sqft)}</span></div>` : ''}`;
}

/** Label for the "View … Homes for Sale" CTA. Mirrors what the listings
 *  section shows by default: the matching count when listing-level filters
 *  carve out a subset, no count when a shown community has homes but none
 *  match (the panel surfaces a note instead), otherwise the full count. */
function listingsCtaLabel(community) {
  const items = community.activeListings?.items;
  const hasItems = Array.isArray(items) && items.length > 0;
  if (hasItems && hasListingLevelFilters()) {
    const matching = items.filter(listingMatchesActiveFilters);
    if (matching.length === 0) return 'View Homes for Sale';
    if (matching.length < items.length) {
      return matching.length === 1
        ? 'View (1) Home for Sale'
        : `View (${matching.length}) Homes for Sale`;
    }
    // All match — fall through to the total count.
  }
  const n = hasItems ? items.length : (community.activeListings?.count || 0);
  return n === 1 ? 'View (1) Home for Sale' : `View (${n}) Homes for Sale`;
}

/** Render a single for-sale listing card. */
function renderListingCard(l, baseHost) {
  const href = l.url
    ? (/^https?:/.test(l.url) ? l.url : baseHost + l.url)
    : null;
  const photo = l.image
    ? `<div class="listing-card-photo"><img src="${escapeHtml(wixImageUrl(l.image, IMG_SIZES.listing))}" alt="" loading="lazy" decoding="async" /></div>`
    : '<div class="listing-card-photo listing-card-photo-empty" aria-hidden="true"></div>';
  const isLand = isLandListing(l);
  const metaBits = [
    l.beds != null ? `${l.beds} bd` : null,
    l.baths != null ? `${l.baths} ba` : null,
    // Skip the "0 sqft" placeholder (land lots and incomplete records).
    l.sqftText && l.sqftText !== '0' ? `${escapeHtml(l.sqftText)} sqft` : null,
  ].filter(Boolean);
  const meta = metaBits.length
    ? `<div class="listing-card-meta">${metaBits.join(' · ')}</div>`
    : '';
  const typeLabel = isLand ? 'Land' : l.homeType;
  const sub = [
    typeLabel ? escapeHtml(typeLabel) : null,
    (!isLand && l.garage) ? `${escapeHtml(l.garage)} garage` : null,
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
}

/**
 * Render the active-listings section (price card grid) that sits beneath
 * the location map in the detail panel. Returns '' when there's nothing
 * to render so the panel skips the section entirely.
 *
 * When the active filters apply at the listing level (price / beds / home
 * type), the panel shows only the matching homes by default, with a toggle
 * to reveal every home in the community. Reflects the `listingsShowAll`
 * module flag.
 */
function renderListings(community) {
  const items = community.activeListings?.items;
  if (!Array.isArray(items) || items.length === 0) return '';
  const baseHost = 'https://www.lifeinlongboatkey.com';

  const filtersActive = hasListingLevelFilters();
  const matching = filtersActive ? items.filter(listingMatchesActiveFilters) : items;
  const allCount = items.length;

  const noneMatch = filtersActive && matching.length === 0;
  const hasSubset = filtersActive && matching.length > 0 && matching.length < allCount;

  let shown;
  let heading;
  let controlHtml = '';

  if (noneMatch) {
    // The community has active homes but none match the filters (only
    // reachable when 'Currently for sale' is off — it's excluded otherwise).
    // Don't auto-show them; surface a note + an explicit reveal button.
    heading = 'Homes for Sale';
    if (listingsShowAll) {
      shown = items;
      controlHtml = `<button type="button" class="listings-toggle" data-listings-toggle>Hide homes that don’t match</button>`;
    } else {
      shown = [];
      controlHtml = `
        <div class="listings-empty">None of the active homes in this community match your filters.</div>
        <button type="button" class="listings-showall-btn" data-listings-toggle>View all homes for sale</button>`;
    }
  } else if (hasSubset) {
    if (listingsShowAll) {
      shown = items;
      heading = `${allCount} Home${allCount === 1 ? '' : 's'} for Sale`;
      controlHtml = `<button type="button" class="listings-toggle" data-listings-toggle>Show only the ${matching.length} matching your filters</button>`;
    } else {
      shown = matching;
      heading = `${matching.length} Matching Home${matching.length === 1 ? '' : 's'} for Sale`;
      controlHtml = `<button type="button" class="listings-toggle" data-listings-toggle>Show all ${allCount} homes in this community</button>`;
    }
  } else {
    // All listings match, or no listing-level filters are active.
    shown = items;
    heading = `${allCount} Home${allCount === 1 ? '' : 's'} for Sale`;
  }

  const cards = shown.map((l) => renderListingCard(l, baseHost)).join('');
  const cardsHtml = cards ? `<ul class="listing-grid">${cards}</ul>` : '';
  return `
    <section class="detail-listings" id="detail-listings" aria-label="Homes for sale">
      <div class="detail-listings-label">${escapeHtml(heading)}</div>
      ${controlHtml}
      ${cardsHtml}
    </section>`;
}

/** Wire the "show all / show matching" toggle. Re-renders just the listings
 *  section in place and rebinds itself; listing cards are plain anchors so
 *  they need no rebinding. */
function wireListingsToggle(root, community) {
  const btn = root.querySelector('[data-listings-toggle]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    listingsShowAll = !listingsShowAll;
    const section = root.querySelector('#detail-listings');
    if (section) section.outerHTML = renderListings(community);
    wireListingsToggle(root, community);
  });
}

/**
 * Refresh the open detail panel's listings section + "View Homes" CTA after
 * a filter change, so the matching listings update live without the user
 * having to re-click the community. Re-renders only the listings section
 * (keeps gallery state and scroll position). No-op when the panel is closed.
 */
export function refreshOpenDetailListings() {
  const community = state.selectedCommunity;
  if (!community) return;
  const el = document.getElementById('detailContent');
  if (!el) return;

  // Price / beds / sqft ranges depend on the 'Currently for sale' toggle,
  // so refresh them too (active when on, historic when off).
  const priceEl = el.querySelector('.detail-price');
  if (priceEl) priceEl.textContent = displayRange(community, 'priceRange') || '—';
  const metaEl = el.querySelector('.detail-meta');
  if (metaEl) metaEl.innerHTML = detailMetaHtml(community);

  // Re-evaluate from the default ("matching") view against the new filters.
  listingsShowAll = false;
  const section = el.querySelector('#detail-listings');
  if (section) {
    const fresh = renderListings(community);
    if (fresh) {
      section.outerHTML = fresh;
      wireListingsToggle(el, community);
    } else {
      section.remove();
    }
  }
  const cta = el.querySelector('[data-scroll-to="detail-listings"]');
  if (cta) cta.textContent = listingsCtaLabel(community);
}

/**
 * Render the selected community into the detail panel and open it.
 *
 * @param {object} community
 */
export function showDetail(community) {
  state.selectedCommunity = community;
  // Each open starts in "matching only" mode; the toggle flips it.
  listingsShowAll = false;
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

  // Active-listing ranges when 'Currently for sale' is on; historic ranges
  // when off (displayRange handles the toggle + cross-fallback).
  const priceRange = displayRange(community, 'priceRange');
  const homesCta = listingsCtaLabel(community);

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
      <div class="detail-meta">${detailMetaHtml(community)}</div>
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
  wireListingsToggle(el, community);

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
