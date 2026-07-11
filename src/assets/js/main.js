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
  setRichListCards,
} from './modules/list.js';
import {
  initMap,
  renderMap,
  setHighlightedPin,
  setHighlightedPolygon,
  focusCommunity,
  invalidateSize,
  fitToCommunities,
} from './modules/map.js';
import {
  getEmbedParams,
  findCommunityBySlug,
  findGroup,
  filterByGroup,
  fullMapUrl,
  groupMapUrl,
} from './modules/embed.js';
import { staticMapForGroup } from './modules/utils.js';
import {
  startEmbedHeightReporting,
  scrollHostToTop,
  reportEmbedHeight,
} from './modules/embed-height.js';
import { saveFilterState, restoreFilterState } from './modules/persist.js';

const communities = getCommunities();
const { embed, communitySlug, groupSlug } = getEmbedParams();
const focusTarget = findCommunityBySlug(communities, communitySlug);
const group = findGroup(groupSlug);

// The set the interactive app operates on. A group embed scopes the whole
// experience — filters, counts, list, and map — to that cluster; every other
// surface sees the full dataset.
const workingSet = group ? filterByGroup(communities, group) : communities;

const totalEl = document.getElementById('totalCount');
if (totalEl) totalEl.textContent = String(workingSet.length);

// Rich list cards everywhere the interactive app runs (standalone map and
// group embeds alike): corner tag pills, homes-for-sale count, facts row,
// and amenity chips on desktop widths. body.list-rich carries the CSS;
// mobile keeps the compact rows (rich extras hide below the breakpoint).
setRichListCards(true);
document.body.classList.add('list-rich');
// The map is framed to the group inside a hidden (zero-size) container when
// the boot view is the list — re-frame it on the first flip to Map.
let needsGroupRefit = false;

function highlight(name) {
  state.highlightedName = name;
  // A community is either a marker (condo / polygon-less neighborhood) or a
  // polygon — drive both; each is a no-op for the type it doesn't apply to.
  setHighlightedPin(name);
  setHighlightedPolygon(name);
}

/* Browser-back support for the mobile fullscreen surfaces. On mobile the
   results list, the "Narrow it down" filter drawer, and the community
   details panel each cover the whole viewport, so users habitually press
   the system back button (or swipe back) expecting to return to the
   screen they were just on — which would otherwise leave the site.

   The model is temporal, not spatial: each history entry we push stores a
   snapshot of the UI (view / drawer / community), and back or forward
   restores whatever the target entry describes — so back can REOPEN a
   surface, not just close one. Drawer → Save → list, then back, brings
   the drawer back with the criteria still set. Advancing gestures (open
   the drawer, open details, enter the list, Save) push an entry;
   dismissing gestures (the × pill, the Map toggle, locate-on-map, a
   filtered-out details close) retreat to the matching earlier entry so an
   on-screen close never leaves a dead back press. Switching communities
   inside the open details panel replaces its entry in place — one back
   press always exits to results, not back through every community viewed.
   Desktop keeps standard back behavior, gated by the same 860px
   breakpoint mobile.css uses; the desktop iframe embeds never run the
   interactive app at mobile widths, so no iframe history entanglement. */
const MOBILE_BACK_MQ = window.matchMedia('(max-width: 860px)');
// Group boots land on the detailed list on desktop; on mobile (the poster's
// full-screen target) the map is the better first impression, with the
// list one toggle away. The history baseline matches the boot view so the
// first back press exits the page instead of flipping views.
const GROUP_BOOTS_TO_LIST = !!group && !MOBILE_BACK_MQ.matches;
const BASE_SNAPSHOT = { view: GROUP_BOOTS_TO_LIST ? 'list' : 'map', drawer: false, detail: null };

let histChain = [BASE_SNAPSHOT]; // snapshot per entry we occupy, bottom → top
let suppressPopstates = 0;       // popstates caused by our own history.go()
let inPopstateApply = false;     // a back/forward restore is running
let settleQueued = false;
let forceAdvance = false;        // Save pushes even when retreat would match

function currentSnapshot() {
  return {
    view: state.view === 'list' ? 'list' : 'map',
    drawer: document.body.classList.contains('filters-open'),
    detail: state.selectedCommunity?.name ?? null,
  };
}

const snapEqual = (a, b) =>
  a.view === b.view && a.drawer === b.drawer && a.detail === b.detail;
// Same surfaces open, different community — replaces instead of stacking.
const snapSameShape = (a, b) =>
  a.view === b.view && a.drawer === b.drawer && !!a.detail && !!b.detail;

/** Reconcile the history stack with the UI after a gesture. Queued as a
 *  microtask so compound gestures (Save = close drawer + enter list;
 *  locate-on-map = close details + exit list) settle as ONE history
 *  operation instead of racing chained async traversals. */
function settleHistory() {
  if (inPopstateApply || settleQueued) return;
  settleQueued = true;
  queueMicrotask(() => {
    settleQueued = false;
    const advance = forceAdvance;
    forceAdvance = false;
    // Desktop never holds entries (only reachable if armed pre-rotation).
    if (!MOBILE_BACK_MQ.matches) {
      if (histChain.length > 1) {
        suppressPopstates++;
        history.go(-(histChain.length - 1));
        histChain = [histChain[0]];
      }
      return;
    }
    const snap = currentSnapshot();
    const top = histChain[histChain.length - 1];
    if (snapEqual(snap, top)) return;
    if (!advance) {
      // Dismissal to a state we've been in: traverse back to it so the
      // browser stack stays in step with the on-screen close.
      for (let i = histChain.length - 2; i >= 0; i--) {
        if (snapEqual(snap, histChain[i])) {
          suppressPopstates++;
          history.go(-(histChain.length - 1 - i));
          histChain = histChain.slice(0, i + 1);
          return;
        }
      }
      if (snapSameShape(snap, top)) {
        histChain[histChain.length - 1] = snap;
        history.replaceState({ lbkUi: snap, d: histChain.length - 1 }, '');
        return;
      }
    }
    history.pushState({ lbkUi: snap, d: histChain.length }, '');
    histChain.push(snap);
  });
}

/** Open/close surfaces to match the snapshot a back/forward landed on. */
function applySnapshot(snap) {
  inPopstateApply = true;
  document.body.classList.toggle('filters-open', snap.drawer);
  const selected = state.selectedCommunity?.name ?? null;
  if (snap.detail && snap.detail !== selected) {
    const c = workingSet.find((x) => x.name === snap.detail);
    if (c) {
      highlight(c.name);
      showDetail(c);
      focusCommunity(c);
    }
  } else if (!snap.detail && selected) {
    hideDetail();
    highlight(null);
  }
  if (state.view !== snap.view) setView(snap.view);
  invalidateSize();
  inPopstateApply = false;
}

window.addEventListener('popstate', (e) => {
  if (suppressPopstates > 0) {
    suppressPopstates--;
    return;
  }
  // Each entry records its own depth, so duplicate-looking snapshots
  // (e.g. two visits to the list) can't desync our position tracking.
  const d = e.state?.lbkUi ? e.state.d : 0;
  const snap = e.state?.lbkUi || BASE_SNAPSHOT;
  histChain = histChain.slice(0, d);
  while (histChain.length < d) histChain.push(snap); // forward jump gap-fill
  histChain.push(snap);
  applySnapshot(snap);
});

/**
 * Open the details panel for a community and highlight its pin.
 */
function openDetail(community) {
  highlight(community.name);
  showDetail(community);
  focusCommunity(community);
  invalidateSize();
  // Auto-height embeds: the panel renders from the frame's top — if the
  // visitor opened it from deep in the list, bring the top on screen.
  // No-op outside a listening host.
  scrollHostToTop();
  settleHistory();
}

function closeDetail() {
  hideDetail();
  highlight(null);
  invalidateSize();
  settleHistory();
}

/** Dismiss the "Narrow it down" drawer in place (filters apply live, so
 *  there's nothing to save or roll back). Save additionally jumps to the
 *  list view — see the filtersSave handler. */
function closeFilterDrawer() {
  document.body.classList.remove('filters-open');
  settleHistory();
}

/** apply() alias the narrowing filters call. (It used to arm a desktop
 *  "flip to list on first refine" — removed as too jarring; the alias
 *  stays so the filter wiring is unchanged.) */
function applyNarrowing() {
  apply();
}

function apply() {
  const filtered = getFiltered(workingSet);
  const resultCount = document.getElementById('resultCount');
  if (resultCount) resultCount.textContent = String(filtered.length);
  renderMap(filtered);
  renderMobileList(filtered);

  // Refresh filter counts — each option shows how many communities would
  // remain if that option were toggled on top of the current state.
  renderFilters(workingSet, applyNarrowing);

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

  // Session filter memory — clicking a listing navigates the page away
  // (target=_top); when bfcache misses on the way back, boot restores this.
  saveFilterState();
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
  if (view === 'map') {
    invalidateSize();
    if (needsGroupRefit) {
      needsGroupRefit = false;
      if (state.selectedCommunity) focusCommunity(state.selectedCommunity, { duration: 0 });
      else fitToCommunities(workingSet);
    }
  }
  saveFilterState();
  settleHistory();
}

/** Restore session filter memory (if any) and sync the static controls
 *  (type pills + 'Currently for sale' toggle) that renderFilters doesn't
 *  own. Returns the saved snapshot so boots can restore the view too. */
function restoreSessionFilters() {
  const saved = restoreFilterState();
  if (!saved) return null;
  document.querySelectorAll('.type-pill').forEach((p) => {
    const active = p.dataset.type === state.type;
    p.classList.toggle('active', active);
    p.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  document
    .getElementById('forSaleToggle')
    ?.setAttribute('aria-pressed', state.hasListingsOnly ? 'true' : 'false');
  return saved;
}

// No layout toggle anymore; setLayout is only called internally by
// openDetail / closeDetail. Kept as a safe no-op for setupStaticControls.
function setLayout() {
  invalidateSize();
}

/**
 * Wire the interactive controls shared by the full app and the featured
 * group embed: filter panel, details-panel close, filter drawer, Map/List
 * toggle, list-item clicks, and the "locate on map" link. Both surfaces use
 * the identical event flow — only the map setup (below) differs.
 */
function wireInteractiveApp() {
  renderFilters(workingSet, applyNarrowing);
  setupStaticControls(workingSet, { apply, applyNarrowing, setLayout });

  // Close button for the details panel (× on desktop, "Back to results"
  // pill on mobile / embed — both dismiss the panel and return to results).
  document.getElementById('detailClose')?.addEventListener('click', closeDetail);
  document.getElementById('detailBack')?.addEventListener('click', closeDetail);

  // Filter drawer: open the full-screen overlay; close via Save or the
  // browser back button (which dismisses in place, without the list jump).
  document.getElementById('filtersToggle')?.addEventListener('click', () => {
    document.body.classList.add('filters-open');
    settleHistory();
  });
  document.getElementById('filtersSave')?.addEventListener('click', () => {
    // Save ADVANCES to the results rather than dismissing the drawer, so
    // it pushes a new entry — back from the list reopens the drawer.
    forceAdvance = true;
    closeFilterDrawer();
    // After narrowing down, jump straight to the list so results are
    // immediately scannable.
    setView('list');
  });

  // View toggle (Map | List).
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
}

/**
 * Full interactive map — the standalone app at map.lifeinlongboatkey.com.
 * Filters, list, view toggle, and the details panel.
 */
function bootFull() {
  const saved = restoreSessionFilters();
  wireInteractiveApp();

  initMap(workingSet, {
    onSelect: openDetail,
    neighborhoodPolygons: getNeighborhoodPolygons(),
    // When scoped to a group (?group=<slug>), open focused on that cluster
    // and skip the island-wide zone bubbles — this is the full-screen target
    // the mobile embed poster opens. Otherwise the normal island view.
    zones: group ? false : undefined,
    onReady: () => {
      if (group) fitToCommunities(workingSet);
      // Deep-link: ?community=<slug> opens that community's detail panel.
      if (focusTarget) openDetail(focusTarget);
    },
  });

  apply();
  // Boot view: a restored session view wins on desktop; otherwise group
  // visits open on the detailed list and mobile keeps the map (the
  // poster's target), list one toggle away.
  const bootList =
    saved && !MOBILE_BACK_MQ.matches ? saved.view === 'list' : GROUP_BOOTS_TO_LIST;
  if (bootList) {
    needsGroupRefit = true;
    setView('list');
  }
}

/**
 * Embed boot — the full filter / list / details experience inside a host
 * page iframe (same app as the standalone map, site header hidden).
 * Group embeds (`?embed=bay-isles`) scope everything to the cluster and
 * boot list-first with the map fitted to the group. Community embeds
 * (`?embed=1&community=<slug>`) keep the island-wide set and boot on the
 * map, focused on their community with its details panel open. On mobile
 * both show a poster that opens the full app as a top-level page instead
 * (iframes can't go full-screen on iOS and Wix scales them awkwardly).
 */
function bootEmbedApp() {
  // The inline head script adds both classes pre-paint; mirror here so the
  // mode is self-contained even if that script is removed.
  document.documentElement.classList.add('embed', 'embed-app');

  const isMobile = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  if (isMobile) {
    showEmbedPoster();
    return;
  }

  const saved = restoreSessionFilters();

  wireInteractiveApp();

  initMap(workingSet, {
    onSelect: openDetail,
    neighborhoodPolygons: getNeighborhoodPolygons(),
    // Group embeds suppress the island-wide zone bubbles (no point
    // collapsing a small cluster); island-wide embeds keep them.
    zones: group ? false : undefined,
    // Embedded in a scrollable host page — don't trap the page scroll.
    cooperativeGestures: true,
    onReady: () => {
      if (group) {
        fitToCommunities(workingSet);
        // Honor a community deep-link inside the group if one was passed.
        if (focusTarget) openDetail(focusTarget);
      } else if (focusTarget) {
        // The page's own community: focus tight and open its panel.
        // (openDetail's own flyTo would land at a looser zoom.)
        highlight(focusTarget.name);
        showDetail(focusTarget);
        focusCommunity(focusTarget, {
          // Neighborhoods read as areas — pull back so the polygon is in
          // frame; condos are points, so go in tighter.
          zoom: focusTarget.type === 'neighborhood' ? 14.5 : 15.5,
          duration: 0,
        });
        invalidateSize();
      }
    },
  });

  apply();
  // Boot view: a restored session view wins. Otherwise group and generic
  // (unscoped) embeds boot on the detailed list — the browsing surface —
  // and only community embeds stay on the map, focused on their
  // community with its panel open.
  const bootList = saved ? saved.view === 'list' : group || !focusTarget;
  if (bootList) {
    needsGroupRefit = true;
    setView('list');
  }

  // Tell an auto-sizing host (the <lbk-map-embed> custom element) how tall
  // the content is, so the iframe grows instead of scrolling internally.
  startEmbedHeightReporting();
}

/**
 * Mobile embed poster — a map image with a "Find your home in <X>" CTA.
 * Tapping opens the full app (scoped to the group, or focused on the
 * community) in a new tab — a native full-screen experience instead of
 * the scaled-down iframe. The static poster element lives in index.html
 * so it paints immediately; here we fill in the image, link, and label.
 */
function showEmbedPoster() {
  document.documentElement.classList.add('embed-poster');
  // The poster has no natural height (the image fills whatever it gets, at
  // 100vh) — give an auto-height host a pleasing portrait proportion
  // derived from the frame's width. Width-driven, so no resize feedback.
  const posterHeight = () =>
    Math.round(Math.min(Math.max(window.innerWidth * 1.3, 420), 820));
  reportEmbedHeight(posterHeight());
  window.addEventListener('resize', () => reportEmbedHeight(posterHeight()));
  const poster = document.getElementById('embedPoster');
  if (!poster) return;
  poster.href = group ? groupMapUrl(groupSlug) : fullMapUrl(focusTarget);
  const label = group?.label || focusTarget?.name || 'Longboat Key';
  const cta = poster.querySelector('.embed-poster-cta');
  if (cta) cta.textContent = `Find your home in ${label}`;
  poster.setAttribute('aria-label', `Find your home in ${label}`);
  const img = staticMapForGroup(
    group ? workingSet : focusTarget ? [focusTarget] : workingSet,
  );
  if (img) {
    const el = document.createElement('img');
    el.className = 'embed-poster-img';
    el.alt = '';
    el.decoding = 'async';
    el.src = img;
    poster.insertBefore(el, poster.firstChild);
  }
}

if (embed) bootEmbedApp();
else bootFull();
