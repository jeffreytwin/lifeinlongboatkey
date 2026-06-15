/**
 * Mapbox GL map — zone bubbles at low zoom, individual pins when zoomed in.
 *
 * UX model: at zoom < ZONE_ZOOM_THRESHOLD, the map shows three big bubbles
 * ("North End", "Mid-Key", "South End") with the count of matching
 * communities in each zone. Click a bubble to fly into that zone and see
 * individual pins. This is the primary view for orientation and
 * intentionally avoids relying on exact per-community coordinates.
 *
 * At higher zoom the zone bubbles hide and the map shows Mapbox's built-in
 * cluster bubbles (for any residual clustering) plus individual HTML
 * markers for each community — those use the teardrop .pin styling from
 * the mockup.
 */

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { locationLabel, escapeHtml, communityThumbUrl } from './utils.js';

const SOURCE_ID = 'communities';
const CLUSTER_LAYER_ID = 'clusters';
const CLUSTER_COUNT_LAYER_ID = 'cluster-count';
const UNCLUSTERED_LAYER_ID = 'unclustered-hit';
const NBHD_SOURCE_ID = 'neighborhoods';
const NBHD_FILL_LAYER_ID = 'neighborhoods-fill';
const NBHD_LINE_LAYER_ID = 'neighborhoods-line';
const SAT_SOURCE_ID = 'satellite';
const SAT_LAYER_ID = 'satellite-basemap';

const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

// Longboat Key bounds: [west, south], [east, north]
const LBK_BOUNDS = [
  [-82.76, 27.26],
  [-82.48, 27.52],
];

// Zoom at/above which we switch from zone bubbles to individual pins.
const ZONE_ZOOM_THRESHOLD = 13;

// Zone anchor points — centroids where the big bubbles sit.
const ZONES = [
  { id: 'north', label: 'North End', lng: -82.676743, lat: 27.428679 },
  { id: 'mid',   label: 'Mid-Key',   lng: -82.636, lat: 27.387 },
  { id: 'south', label: 'South End', lng: -82.595, lat: 27.342 },
];

let map = null;
/** @type {Map<string, mapboxgl.Marker>} */
const markerByName = new Map();
/** @type {Map<string, mapboxgl.Marker>} */
const zoneBubbleByZone = new Map();
let currentPopup = null;
let currentList = [];
let onSelect = () => {};
let neighborhoodPolygons = null; // FeatureCollection
/** Names of neighborhoods that have a polygon — these skip the circle marker. */
const polygonNames = new Set();
/** Touch two-tap state: name of the community whose preview card is currently
 *  showing. A second tap on the same community opens the detail panel; a tap
 *  elsewhere dismisses. Unused on hover-capable devices. */
let previewedName = null;
let hoveredPolygonName = null;
/** Name of the neighborhood polygon currently pinned as "highlighted"
 *  (embed/deep-link focus). Distinct from the transient hover state. */
let highlightedPolygonName = null;

// Hover previews only make sense on real pointer devices. Touch devices
// ("hover: none") would otherwise need a double-tap to fire click after
// the hover state shows — one tap to "hover", another to click.
const canHover = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(hover: hover)').matches;

/**
 * Initialize the map. Must be called once at boot after index.html is in
 * the DOM. Returns true on success, false if we couldn't initialize (e.g.
 * missing Mapbox token).
 */
export function initMap(communities, callbacks) {
  onSelect = callbacks.onSelect || (() => {});
  const onReady = callbacks.onReady || (() => {});
  neighborhoodPolygons = callbacks.neighborhoodPolygons || null;
  if (neighborhoodPolygons) {
    for (const f of neighborhoodPolygons.features) polygonNames.add(f.properties.name);
  }

  const token = window.config?.mapboxAccessToken;
  if (!token || token === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') {
    renderMapTokenNotice();
    return false;
  }
  mapboxgl.accessToken = token;

  const container = document.getElementById('map');
  if (!container) return false;

  map = new mapboxgl.Map({
    container,
    style: MAP_STYLE,
    center: [-82.635, 27.385],
    zoom: 11.5,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: LBK_BOUNDS,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');
  map.addControl(new BasemapToggleControl(), 'bottom-right');

  map.on('load', () => {
    addSatelliteBasemap();
    addNeighborhoodPolygons();
    setCommunityFeatures(communities);
    wireClusterInteractions();
    wireNeighborhoodPolygonInteractions(communities);
    wireHoverCardTap(communities);
    syncMarkers(communities);
    syncZoneBubbles(communities);
    setNeighborhoodPolygonFilter(communities);
    updateZoomDependentVisibility();
    map.on('moveend', updateZoomDependentVisibility);
    map.on('sourcedata', (e) => {
      if (e.sourceId === SOURCE_ID && e.isSourceLoaded) updateZoomDependentVisibility();
    });
    // Mapbox's 'load' can fire while sprites/glyphs are still loading,
    // so queryRenderedFeatures inside updateZoomDependentVisibility can
    // come back empty on the first pass. 'idle' fires once everything
    // has settled — gate one final visibility pass on it.
    map.once('idle', updateZoomDependentVisibility);

    // Markers and polygons now exist; let the caller focus/highlight a
    // community (full-map deep-link or location-page embed).
    onReady();
  });

  // Close popup / dismiss the touch preview when tapping empty map
  // (anywhere not a cluster or polygon).
  map.on('click', (e) => {
    const layers = [CLUSTER_LAYER_ID];
    if (map.getLayer(NBHD_FILL_LAYER_ID)) layers.push(NBHD_FILL_LAYER_ID);
    const hits = map.queryRenderedFeatures(e.point, { layers });
    if (!hits.length) {
      if (currentPopup) { currentPopup.remove(); currentPopup = null; }
      hidePreview();
    }
  });

  return true;
}

function renderMapTokenNotice() {
  const el = document.getElementById('map');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:40px;text-align:center;color:#605E5E;font-family:Manrope,sans-serif;height:100%;display:flex;align-items:center;justify-content:center;">
      <div style="max-width:380px">
        <div style="font-family:Fraunces,serif;font-size:20px;margin-bottom:8px;color:#2D2D2D">Map unavailable</div>
        <p style="font-size:13px;margin:0">Set a Mapbox access token in <code>config.js</code> to enable the map. The filter panel and list view work without it.</p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Satellite basemap. Rather than swapping the whole Mapbox style (which wipes
// every custom source/layer and feature-state), we add Mapbox's satellite
// imagery as a raster layer and toggle its visibility. It's inserted just
// below the basemap's first symbol (label) layer, so place/road labels stay
// readable on top of the imagery, while our pins and neighborhood polygons —
// added later, above everything — remain fully intact.
// ---------------------------------------------------------------------------

/** Id of the lowest symbol layer in the base style, used as the insert anchor. */
function firstSymbolLayerId() {
  const layers = map.getStyle()?.layers || [];
  const sym = layers.find((l) => l.type === 'symbol');
  return sym ? sym.id : undefined;
}

function addSatelliteBasemap() {
  if (!map || map.getSource(SAT_SOURCE_ID)) return;
  map.addSource(SAT_SOURCE_ID, {
    type: 'raster',
    url: 'mapbox://mapbox.satellite',
    tileSize: 256,
  });
  // Hidden by default — tiles aren't fetched until the layer is shown.
  map.addLayer(
    {
      id: SAT_LAYER_ID,
      type: 'raster',
      source: SAT_SOURCE_ID,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 1 },
    },
    firstSymbolLayerId(),
  );
}

/** Show satellite imagery ('satellite') or the default light basemap ('map'). */
function setBasemap(styleName) {
  if (!map || !map.getLayer(SAT_LAYER_ID)) return;
  map.setLayoutProperty(
    SAT_LAYER_ID,
    'visibility',
    styleName === 'satellite' ? 'visible' : 'none',
  );
}

/** Lower-right "Map | Satellite" segmented toggle (a Mapbox custom control). */
class BasemapToggleControl {
  onAdd(mapInstance) {
    this._map = mapInstance;
    const c = document.createElement('div');
    c.className = 'mapboxgl-ctrl basemap-toggle';
    c.innerHTML = `
      <button type="button" class="basemap-btn is-active" data-style="map">Map</button>
      <button type="button" class="basemap-btn" data-style="satellite">Satellite</button>`;
    c.addEventListener('click', (e) => {
      const btn = e.target.closest('.basemap-btn');
      if (!btn) return;
      setBasemap(btn.dataset.style);
      c.querySelectorAll('.basemap-btn').forEach((b) =>
        b.classList.toggle('is-active', b === btn),
      );
    });
    this._container = c;
    return c;
  }

  onRemove() {
    this._container?.remove();
    this._map = null;
  }
}

function addNeighborhoodPolygons() {
  if (!map || !neighborhoodPolygons) return;
  // Each feature gets a state-backed 'hover' flag used for the hover style.
  map.addSource(NBHD_SOURCE_ID, {
    type: 'geojson',
    data: neighborhoodPolygons,
    promoteId: 'name',
  });
  map.addLayer({
    id: NBHD_FILL_LAYER_ID,
    type: 'fill',
    source: NBHD_SOURCE_ID,
    paint: {
      // Brighter orange (vs. the brand gold) so the fill reads as
      // "orange" on the cream basemap instead of a yellow smudge.
      // Selected polygons switch to the gold selection color.
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'highlight'], false], '#C2660F',  // --selected (darker orange)
        '#E07A1A',
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'highlight'], false], 0.66,
        ['boolean', ['feature-state', 'hover'], false], 0.58,
        0.40,
      ],
    },
  });
  map.addLayer({
    id: NBHD_LINE_LAYER_ID,
    type: 'line',
    source: NBHD_SOURCE_ID,
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'highlight'], false], '#8A4708',  // --selected-deep for selected
        '#A05816',  // darker orange to match the brighter fill
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'highlight'], false], 3,
        ['boolean', ['feature-state', 'hover'], false], 2.5,
        1.5,
      ],
    },
  });
}

function wireNeighborhoodPolygonInteractions(communities) {
  if (!map || !neighborhoodPolygons) return;

  // Click flow:
  //   - Pointer devices: single tap opens the detail panel (hover has
  //     already previewed it).
  //   - Touch devices: first tap shows the preview card; a second tap on
  //     the same polygon opens the detail panel (matches the mouse-over
  //     experience on desktop).
  map.on('click', NBHD_FILL_LAYER_ID, (e) => {
    if (!e.features?.length) return;
    const name = e.features[0].properties.name;
    const c = communities.find((x) => x.name === name);
    if (!c) return;
    if (!canHover) {
      handleTouchSelect(c, toClientXY(e.originalEvent));
    } else {
      hidePreview();
      onSelect(c);
    }
  });

  // Hover previews are pointer-only (skipped on touch to avoid the
  // tap-to-hover, tap-again-to-click pattern).
  if (!canHover) return;

  map.on('mouseenter', NBHD_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', NBHD_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
    hideHoverCard();
    if (hoveredPolygonName) {
      map.setFeatureState(
        { source: NBHD_SOURCE_ID, id: hoveredPolygonName },
        { hover: false },
      );
      hoveredPolygonName = null;
    }
  });
  map.on('mousemove', NBHD_FILL_LAYER_ID, (e) => {
    if (!e.features?.length) return;
    const name = e.features[0].properties.name;
    moveHoverCard(e.originalEvent);
    if (hoveredPolygonName === name) return;
    if (hoveredPolygonName) {
      map.setFeatureState(
        { source: NBHD_SOURCE_ID, id: hoveredPolygonName },
        { hover: false },
      );
    }
    hoveredPolygonName = name;
    const c = communities.find((x) => x.name === name);
    if (c) showHoverCard(c, e.originalEvent);
    map.setFeatureState(
      { source: NBHD_SOURCE_ID, id: name },
      { hover: true },
    );
  });
}

/**
 * Show only the polygons that match the current filtered list.
 */
function setNeighborhoodPolygonFilter(list) {
  if (!map || !map.getLayer(NBHD_FILL_LAYER_ID)) return;
  const visibleNames = new Set(
    list.filter((c) => c.type === 'neighborhood').map((c) => c.name),
  );
  const namesArr = [...visibleNames];
  const filter = namesArr.length
    ? ['in', ['get', 'name'], ['literal', namesArr]]
    : ['==', ['get', 'name'], '__none__'];  // match nothing
  map.setFilter(NBHD_FILL_LAYER_ID, filter);
  map.setFilter(NBHD_LINE_LAYER_ID, filter);
}

function setCommunityFeatures(list) {
  if (!map) return;
  const data = toGeoJson(list);
  const existing = map.getSource(SOURCE_ID);
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data,
    // Clustering intentionally off: the zone-bubble view handles the
    // low-zoom "too many pins" problem, so cluster circles between
    // ZONE_ZOOM_THRESHOLD and full zoom were just visual noise.
    cluster: false,
  });

  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#1F6B5A',  // --teal-deep
      'circle-opacity': 0.9,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
      'circle-radius': [
        'step', ['get', 'point_count'],
        16, 5, 20, 15, 26, 30, 32,
      ],
    },
  });
  map.addLayer({
    id: CLUSTER_COUNT_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#FFFFFF' },
  });

  // Invisible hit layer for non-clustered points.
  map.addLayer({
    id: UNCLUSTERED_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: { 'circle-radius': 0, 'circle-opacity': 0 },
  });
}

function wireClusterInteractions() {
  if (!map) return;
  map.on('click', CLUSTER_LAYER_ID, (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER_ID] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    map.getSource(SOURCE_ID).getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });
  map.on('mouseenter', CLUSTER_LAYER_ID, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', CLUSTER_LAYER_ID, () => (map.getCanvas().style.cursor = ''));
}

function toGeoJson(list) {
  return {
    type: 'FeatureCollection',
    features: list
      .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
      .map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { name: c.name, type: c.type },
      })),
  };
}

/**
 * Sync individual community HTML markers with the current filtered list.
 * Visibility is further constrained by updateZoomDependentVisibility() — at
 * low zoom these are all hidden in favor of zone bubbles.
 */
function syncMarkers(list) {
  if (!map) return;
  currentList = list;
  // Neighborhoods with a polygon are rendered as polygons, not markers.
  const markerable = list.filter((c) => !(c.type === 'neighborhood' && polygonNames.has(c.name)));
  const desired = new Set(markerable.map((c) => c.name));

  markerByName.forEach((marker, name) => {
    if (!desired.has(name)) {
      marker.remove();
      markerByName.delete(name);
    }
  });

  markerable.forEach((c) => {
    if (markerByName.has(c.name)) return;
    const marker = buildMarker(c);
    marker.addTo(map);
    markerByName.set(c.name, marker);
  });
}

/**
 * Sync the three zone bubbles with per-zone counts from the filtered list.
 * Zones with zero matches get their bubble hidden rather than removed.
 */
function syncZoneBubbles(list) {
  if (!map) return;
  const counts = { north: 0, mid: 0, south: 0 };
  for (const c of list) if (counts[c.location] !== undefined) counts[c.location]++;
  ZONES.forEach((z) => {
    let marker = zoneBubbleByZone.get(z.id);
    if (!marker) {
      marker = buildZoneBubble(z);
      marker.addTo(map);
      zoneBubbleByZone.set(z.id, marker);
    }
    const el = marker.getElement();
    el.querySelector('.zone-bubble-count').textContent = String(counts[z.id]);
    el.dataset.empty = counts[z.id] === 0 ? 'true' : 'false';
  });
}

function buildZoneBubble(zone) {
  const el = document.createElement('div');
  el.className = 'zone-bubble';
  el.dataset.zone = zone.id;
  el.innerHTML = `
    <div class="zone-bubble-count">0</div>
    <div class="zone-bubble-label">${zone.label}</div>`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    map.flyTo({
      center: [zone.lng, zone.lat],
      zoom: 14,
      duration: 900,
    });
  });
  return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([zone.lng, zone.lat]);
}

function buildMarker(c) {
  const el = document.createElement('div');
  el.className = 'pin ' + (c.type === 'condo' ? 'pin-condo' : 'pin-nbhd');
  el.dataset.name = c.name;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} — ${locationLabel(c.location)}`);
  el.innerHTML = `<div class="pin-inner">${c.type === 'condo' ? 'C' : 'N'}</div>`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!canHover) {
      handleTouchSelect(c, { clientX: e.clientX, clientY: e.clientY });
    } else {
      hidePreview();
      onSelect(c);
    }
  });
  if (canHover) {
    el.addEventListener('mouseenter', (e) => showHoverCard(c, e));
    el.addEventListener('mousemove', (e) => moveHoverCard(e));
    el.addEventListener('mouseleave', hideHoverCard);
  }
  // Condos (teardrop) anchor to their pointed bottom; neighborhoods
  // (outlined circles) anchor to their center since they read as an area.
  const anchor = c.type === 'condo' ? 'bottom' : 'center';
  return new mapboxgl.Marker({ element: el, anchor }).setLngLat([c.lng, c.lat]);
}

// ---------------------------------------------------------------------------
// Hover card — a small floating preview that follows the cursor when the
// user is over a pin or a neighborhood polygon. Contains photo + name +
// price range; hides on mouseleave.
// ---------------------------------------------------------------------------

function showHoverCard(c, evt) {
  const card = document.getElementById('hoverCard');
  if (!card) return;
  card.innerHTML = `
    <div class="hover-card-photo ${c.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
      <img src="${escapeHtml(communityThumbUrl(c))}" alt="" decoding="async" />
    </div>
    <div class="hover-card-body">
      <div class="hover-card-name">${escapeHtml(c.name)}</div>
      <div class="hover-card-meta">
        ${c.type === 'condo' ? 'Condominiums' : 'Neighborhood'} · ${escapeHtml(locationLabel(c.location))}
      </div>
      <div class="hover-card-price">${escapeHtml(c.priceRange || '—')}</div>
    </div>`;
  card.setAttribute('aria-hidden', 'false');
  card.classList.add('is-visible');
  if (evt) moveHoverCard(evt);
}

function moveHoverCard(evt) {
  const card = document.getElementById('hoverCard');
  const wrap = card?.parentElement;
  if (!card || !wrap || !card.classList.contains('is-visible')) return;
  const rect = wrap.getBoundingClientRect();
  // Cursor position relative to the map-wrap (card's positioning context).
  const cx = evt.clientX - rect.left;
  const cy = evt.clientY - rect.top;
  const cardW = card.offsetWidth || 240;
  const cardH = card.offsetHeight || 180;
  // Offset to keep the card out from under the cursor; flip sides if the
  // cursor is near the right/bottom edges of the map area.
  const PAD = 16;
  let x = cx + PAD;
  let y = cy + PAD;
  if (x + cardW + PAD > rect.width) x = cx - cardW - PAD;
  if (y + cardH + PAD > rect.height) y = cy - cardH - PAD;
  if (x < PAD) x = PAD;
  if (y < PAD) y = PAD;
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
}

function hideHoverCard() {
  const card = document.getElementById('hoverCard');
  if (!card) return;
  card.classList.remove('is-visible');
  card.classList.remove('is-tappable');
  card.setAttribute('aria-hidden', 'true');
}

/** Touch two-tap dispatcher: first tap shows preview, second opens details. */
function handleTouchSelect(c, xy) {
  if (previewedName === c.name) {
    hidePreview();
    onSelect(c);
    return;
  }
  previewedName = c.name;
  showHoverCard(c, xy || undefined);
  const card = document.getElementById('hoverCard');
  card?.classList.add('is-tappable');
}

function hidePreview() {
  previewedName = null;
  hideHoverCard();
}

/** Normalize a DOM mouse or touch event into { clientX, clientY }. */
function toClientXY(evt) {
  if (!evt) return null;
  if (typeof evt.clientX === 'number') {
    return { clientX: evt.clientX, clientY: evt.clientY };
  }
  const t = evt.touches?.[0] || evt.changedTouches?.[0];
  return t ? { clientX: t.clientX, clientY: t.clientY } : null;
}

/** Attach the one-shot tap handler on the hover card. Tapping the card
 *  (only enabled in touch mode via .is-tappable) opens the detail panel
 *  for whichever community is currently previewed. */
function wireHoverCardTap(communities) {
  const card = document.getElementById('hoverCard');
  if (!card) return;
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!previewedName) return;
    const c = communities.find((x) => x.name === previewedName);
    hidePreview();
    if (c) onSelect(c);
  });
}

export function openPopupFor(c) {
  if (!map) return;
  if (currentPopup) currentPopup.remove();
  const html = `
    <div class="popup-photo ${c.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}">
      <img src="${escapeHtml(communityThumbUrl(c))}" alt="" loading="lazy" decoding="async" />
    </div>
    <div class="popup-title">${escapeHtml(c.name)}</div>
    <div class="popup-sub">${c.type === 'condo' ? 'Condo Community' : 'Neighborhood'} · ${escapeHtml(locationLabel(c.location))}</div>
    <div class="popup-price">${escapeHtml(c.priceRange || '—')}</div>
    <div class="popup-desc">${escapeHtml(c.subtitle || '')}</div>
    <a class="popup-link" href="https://www.lifeinlongboatkey.com${escapeHtml(c.pageUrl)}" target="_blank" rel="noopener">View community →</a>`;
  currentPopup = new mapboxgl.Popup({ offset: 32, maxWidth: '280px', closeOnClick: false })
    .setLngLat([c.lng, c.lat])
    .setHTML(html)
    .addTo(map);
}

/**
 * Gate visibility for three things based on current zoom:
 *   - zone bubbles: visible only below the threshold
 *   - cluster bubbles + individual pins: visible only at/above the threshold
 *   - among individual pins, only show those that Mapbox's clustering has
 *     NOT folded into a cluster bubble at the current zoom (otherwise pins
 *     render on top of clusters and the map becomes unreadable).
 */
function updateZoomDependentVisibility() {
  // Inner code is defensive (every layer access is guarded), so don't
  // bail on isStyleLoaded() here — Mapbox's 'load' event can fire before
  // isStyleLoaded() flips to true, leaving the initial visibility pass
  // a no-op and the map stuck with default-visible markers + bubbles.
  if (!map) return;
  const zoomedOut = map.getZoom() < ZONE_ZOOM_THRESHOLD;

  // Zone bubbles
  zoneBubbleByZone.forEach((marker) => {
    const el = marker.getElement();
    el.style.display = zoomedOut && el.dataset.empty !== 'true' ? '' : 'none';
  });

  // Cluster layers
  const clusterVis = zoomedOut ? 'none' : 'visible';
  if (map.getLayer(CLUSTER_LAYER_ID)) {
    map.setLayoutProperty(CLUSTER_LAYER_ID, 'visibility', clusterVis);
    map.setLayoutProperty(CLUSTER_COUNT_LAYER_ID, 'visibility', clusterVis);
  }

  // Neighborhood polygons — hide at zoomed-out so zone bubbles dominate
  if (map.getLayer(NBHD_FILL_LAYER_ID)) {
    map.setLayoutProperty(NBHD_FILL_LAYER_ID, 'visibility', clusterVis);
    map.setLayoutProperty(NBHD_LINE_LAYER_ID, 'visibility', clusterVis);
  }

  // Individual pins
  if (zoomedOut) {
    markerByName.forEach((m) => (m.getElement().style.display = 'none'));
    return;
  }
  if (!map.getLayer(UNCLUSTERED_LAYER_ID)) return;
  const visible = map.queryRenderedFeatures({ layers: [UNCLUSTERED_LAYER_ID] });
  const visibleNames = new Set(visible.map((f) => f.properties.name));
  markerByName.forEach((marker, name) => {
    marker.getElement().style.display = visibleNames.has(name) ? '' : 'none';
  });
}

/**
 * Update the map to match a new filtered list.
 */
export function renderMap(list) {
  if (!map) return;
  if (!map.isStyleLoaded()) {
    map.once('load', () => {
      setCommunityFeatures(list);
      syncMarkers(list);
      syncZoneBubbles(list);
      setNeighborhoodPolygonFilter(list);
      updateZoomDependentVisibility();
    });
    return;
  }
  setCommunityFeatures(list);
  syncMarkers(list);
  syncZoneBubbles(list);
  setNeighborhoodPolygonFilter(list);
  updateZoomDependentVisibility();
}

export function setHighlightedPin(name) {
  markerByName.forEach((marker, n) => {
    marker.getElement().classList.toggle('highlighted', n === name);
  });
}

/**
 * Pin a neighborhood polygon as "highlighted" (brighter fill + thicker
 * outline). Pass null to clear. Safe to call with a name that has no
 * polygon — it's a no-op for circle-marker neighborhoods, which
 * setHighlightedPin() handles instead.
 */
export function setHighlightedPolygon(name) {
  if (!map || !map.getSource(NBHD_SOURCE_ID)) return;
  if (highlightedPolygonName && highlightedPolygonName !== name) {
    map.setFeatureState(
      { source: NBHD_SOURCE_ID, id: highlightedPolygonName },
      { highlight: false },
    );
  }
  highlightedPolygonName = name;
  if (name && polygonNames.has(name)) {
    map.setFeatureState({ source: NBHD_SOURCE_ID, id: name }, { highlight: true });
  }
}

export function focusCommunity(community, { zoom, duration = 650 } = {}) {
  if (!map) return;
  map.flyTo({
    center: [community.lng, community.lat],
    zoom: zoom ?? Math.max(map.getZoom(), 14),
    duration,
  });
}

export function invalidateSize() {
  if (!map) return;
  setTimeout(() => map.resize(), 120);
}
