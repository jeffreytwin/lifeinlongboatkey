/**
 * Entry point — wires the modules together and boots the app.
 *
 * Boot sequence:
 *   1. Load communities from static data
 *   2. Render filter panel (counts derived from full set)
 *   3. Wire static controls (pills, toggle, clear, sort, layout)
 *   4. Initialize map (tolerates missing Mapbox token)
 *   5. Render list + map for the initial (unfiltered) state
 */

import { getCommunities } from './modules/data.js';
import { state } from './modules/state.js';
import { renderFilters, setupStaticControls } from './modules/filters.js';
import { renderList, setHighlightedCard } from './modules/list.js';
import {
  initMap,
  renderMap,
  setHighlightedPin,
  focusCommunity,
  invalidateSize,
} from './modules/map.js';

const communities = getCommunities();

// Populate total count in the header
const totalEl = document.getElementById('totalCount');
if (totalEl) totalEl.textContent = String(communities.length);

/**
 * Central highlight dispatcher — keeps cards and pins in sync.
 */
function highlight(name) {
  state.highlightedName = name;
  setHighlightedCard(name);
  setHighlightedPin(name);
}

/**
 * Re-render everything that depends on filter state.
 */
function apply() {
  const list = renderList(communities, {
    onHighlight: (name) => highlight(name),
    onCardClick: (c) => {
      highlight(c.name);
      focusCommunity(c);
    },
  });
  const resultCount = document.getElementById('resultCount');
  if (resultCount) resultCount.textContent = String(list.length);
  renderMap(list);
}

function setLayout(layout) {
  const content = document.getElementById('content');
  if (content) content.className = 'content layout-' + layout;
  invalidateSize();
}

// First render of filters (before boot) so counts show immediately
renderFilters(communities, apply);
setupStaticControls(communities, { apply, setLayout });

// Initialize the map (safe to fail — list view still works without it)
initMap(communities, {
  onSelect: (c) => highlight(c.name),
});

// First pass
apply();
