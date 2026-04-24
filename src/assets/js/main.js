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
  setListItemClickHandler,
  setLocateOnMapHandler,
} from './modules/list.js';
import {
  initMap,
  renderMap,
  setHighlightedPin,
  focusCommunity,
  invalidateSize,
} from './modules/map.js';

const communities = getCommunities();

const totalEl = document.getElementById('totalCount');
if (totalEl) totalEl.textContent = String(communities.length);

function highlight(name) {
  state.highlightedName = name;
  setHighlightedPin(name);
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
  // filtered out.
  if (state.selectedCommunity && !filtered.some((c) => c.name === state.selectedCommunity.name)) {
    closeDetail();
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

renderFilters(communities, apply);
setupStaticControls(communities, { apply, setLayout });

// Close button for the details panel
document.getElementById('detailClose')?.addEventListener('click', closeDetail);

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

// Clicking the reference map in the details panel (desktop only) flies
// the big map to that community's coordinates. If the user is currently
// in list view, also switch to map view so the flyTo is visible.
setLocateOnMapHandler((community) => {
  if (state.view !== 'map') setView('map');
  // Let the map container remeasure from the view swap before flying.
  setTimeout(() => focusCommunity(community), 140);
});

initMap(communities, {
  onSelect: openDetail,
  neighborhoodPolygons: getNeighborhoodPolygons(),
});

apply();
