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
import { showDetail, hideDetail } from './modules/list.js';
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
  // If the currently-selected community is no longer in the filtered set,
  // close the detail panel to avoid showing a community that's been
  // filtered out.
  if (state.selectedCommunity && !filtered.some((c) => c.name === state.selectedCommunity.name)) {
    closeDetail();
  }
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

initMap(communities, {
  onSelect: openDetail,
  neighborhoodPolygons: getNeighborhoodPolygons(),
});

apply();
