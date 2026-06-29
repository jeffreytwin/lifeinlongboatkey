/**
 * Entry point — wires the modules together and boots the app.
 *
 * UX model: the map is the primary surface. The details panel on the right
 * opens only when the user clicks a pin / polygon / zone bubble, and closes
 * via the X button in the panel header.
 */

import { getCommunities, getNeighborhoodPolygons } from './modules/data.js';
import { state } from './modules/state.js';
import { renderFilters, setupStaticControls } from './modules/filters.js';
import { getFiltered } from './modules/matches.js';
import {
  showDetail,
  hideDetail,
  renderMobileList,
  refreshOpenDetailListings,
  setListItemClickHandler,
  setLocateOnMapHandler,
} from './modules/list.js';
import {
  initMap,
  renderMap,
  setHighlightedPin,
  setHighlightedPolygon,
  focusCommunity,
  invalidateSize,
  openPopupFor,
} from './modules/map.js';
import { getEmbedParams, findCommunityBySlug, fullMapUrl } from './modules/embed.js';

const communities = getCommunities();
const { embed, communitySlug } = getEmbedParams();
const focusTarget = findCommunityBySlug(communities, communitySlug);

const totalEl = document.getElementById('totalCount');
if (totalEl) totalEl.textContent = String(communities.length);

function highlight(name) {
  state.highlightedName = name;
  // A community is either a marker (condo / polygon-less neighborhood) or a
  // polygon — drive both; each is a no-op for the type it doesn't apply to.
  setHighlightedPin(name);
  setHighlightedPolygon(name);
}

/**
 * Open the details panel for a community and highlight its pin.
 */
function openDetail(community) {
  highlight(community.name);
  showDetail(community);
  focusCommunity(community);
  invalidateSize();
}

function closeDetail() {
  hideDetail();
  highlight(null);
  invalidateSize();
}

function apply() {
  const filtered = getFiltered(communities);
  const resultCount = document.getElementById('resultCount');
  if (resultCount) resultCount.textContent = String(filtered.length);
  renderMap(filtered);
  renderMobileList(filtered);

  // Refresh filter counts — each option shows how many communities would
  // remain if that option were toggled on top of the current state.
  renderFilters(communities, apply);

  // Update the mobile Save button with the running count so users can
  // see how their narrowing is going without dismissing the panel.
  const saveBtn = document.getElementById('filtersSave');
  if (saveBtn) {
    saveBtn.textContent = filtered.length === 1
      ? 'Save · 1 result'
      : `Save · ${filtered.length} results`;
  }

  // If the currently-selected community is no longer in the filtered set,
  // close the detail panel to avoid showing a community that's been
  // filtered out. Otherwise, if it's still showing, refresh its listings
  // so they reflect the new filters without needing a re-click.
  if (state.selectedCommunity && !filtered.some((c) => c.name === state.selectedCommunity.name)) {
    closeDetail();
  } else if (state.selectedCommunity) {
    refreshOpenDetailListings();
  }
}

/** Switch between map and list view on mobile. */
function setView(view) {
  state.view = view;
  document.body.classList.toggle('view-list', view === 'list');
  document.querySelectorAll('.view-switch-btn').forEach((btn) => {
    const isActive = btn.dataset.view === view;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  // When switching back to map, the map may have been hidden and its
  // container resized; tell Mapbox to re-measure.
  if (view === 'map') invalidateSize();
}

// No layout toggle anymore; setLayout is only called internally by
// openDetail / closeDetail. Kept as a safe no-op for setupStaticControls.
function setLayout() {
  invalidateSize();
}

/**
 * Full interactive map — the standalone app at lifeinlongboatkey.web.app.
 * Filters, list, mobile view toggle, and the details panel.
 */
function bootFull() {
  renderFilters(communities, apply);
  setupStaticControls(communities, { apply, setLayout });

  // Close button for the details panel (× on desktop, "Back to results"
  // pill on mobile — both dismiss the panel and return to the map/results).
  document.getElementById('detailClose')?.addEventListener('click', closeDetail);
  document.getElementById('detailBack')?.addEventListener('click', closeDetail);

  // Mobile filters: open the full-screen overlay, then close it via Save.
  document.getElementById('filtersToggle')?.addEventListener('click', () => {
    document.body.classList.add('filters-open');
  });
  document.getElementById('filtersSave')?.addEventListener('click', () => {
    document.body.classList.remove('filters-open');
    // After narrowing down, jump straight to the list so results are
    // immediately scannable. (setView is mobile-only in effect; on
    // desktop body.view-list toggles nothing visible.)
    setView('list');
  });

  // Mobile view toggle (Map | List).
  document.getElementById('viewMapBtn')?.addEventListener('click', () => setView('map'));
  document.getElementById('viewListBtn')?.addEventListener('click', () => setView('list'));
  setListItemClickHandler(openDetail);

  // Clicking the reference map in the details panel flies the big map
  // to that community's coordinates. On desktop the side-column detail
  // panel stays open and the user sees the flyTo on the visible map
  // column. On mobile the detail panel is a fullscreen overlay that
  // would hide the flyTo entirely, so close it first.
  const IS_TOUCH = !(window.matchMedia && window.matchMedia('(hover: hover)').matches);
  setLocateOnMapHandler((community) => {
    if (IS_TOUCH) closeDetail();
    if (state.view !== 'map') setView('map');
    // Let the map container remeasure from the view swap before flying.
    // Zoom near the maximum (18) so the user lands almost-fully-zoomed
    // on the community, and give the animation a slightly longer arc
    // since we may be traveling a greater zoom distance.
    setTimeout(() => focusCommunity(community, { zoom: 17, duration: 850 }), 140);
  });

  initMap(communities, {
    onSelect: openDetail,
    neighborhoodPolygons: getNeighborhoodPolygons(),
    // Deep-link: ?community=<slug> opens that community's detail panel,
    // focused, once the map is ready.
    onReady: () => { if (focusTarget) openDetail(focusTarget); },
  });

  apply();
}

/**
 * Embed mode — the chrome-less single-community view dropped into a Wix
 * location page via <iframe src="…?embed=1&community=<slug>">. All 107
 * communities still render for spatial context, but one is highlighted and
 * the map flies to it; clicking any pin opens a popup (no side panel), and a
 * CTA links out to the full map pre-focused on the same community.
 */
function bootEmbed() {
  // The inline head script already added this before first paint; mirror it
  // here so embed mode is self-contained even if that script is removed.
  document.documentElement.classList.add('embed');

  const cta = document.getElementById('embedCta');
  if (cta) cta.href = fullMapUrl(focusTarget);

  initMap(communities, {
    onSelect: (community) => openPopupFor(community),
    neighborhoodPolygons: getNeighborhoodPolygons(),
    onReady: () => {
      if (!focusTarget) return;
      focusCommunity(focusTarget, {
        // Neighborhoods read as areas — pull back a touch so the whole
        // polygon is in frame; condos are points, so go in tighter.
        zoom: focusTarget.type === 'neighborhood' ? 14.5 : 15.5,
        duration: 0,
      });
      setHighlightedPin(focusTarget.name);
      setHighlightedPolygon(focusTarget.name);
      openPopupFor(focusTarget);
    },
  });
}

if (embed) bootEmbed();
else bootFull();
