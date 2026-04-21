/**
 * Mapbox GL map — pins, clustering, popups, flyTo, card↔pin sync.
 *
 * Translates the mockup's Leaflet implementation (docs/longboat-key-map-mockup.html
 * lines 776–957) into Mapbox GL idioms. Markers are rendered as HTML
 * `mapboxgl.Marker` instances so the teardrop .pin styling from the mockup
 * reuses unchanged. Clustering is implemented via a GeoJSON source with
 * cluster:true and a supercluster-backed cluster layer.
 */

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { locationLabel, escapeHtml } from './utils.js';

const SOURCE_ID = 'communities';
const ZONE_SOURCE_ID = 'zones';
const ZONE_LAYER_ID = 'zone-labels';
const CLUSTER_LAYER_ID = 'clusters';
const CLUSTER_COUNT_LAYER_ID = 'cluster-count';
const UNCLUSTERED_LAYER_ID = 'unclustered-hit'; // invisible; drives hit-testing / fallback

// Longboat Key bounds: [west, south], [east, north]
const LBK_BOUNDS = [
  [-82.76, 27.26],
  [-82.48, 27.52],
];

const ZONE_LABELS = [
  { label: 'North End', lng: -82.688, lat: 27.445 },
  { label: 'Mid-Key', lng: -82.635, lat: 27.388 },
  { label: 'South End', lng: -82.592, lat: 27.33 },
];

let map = null;
/** @type {Map<string, mapboxgl.Marker>} */
const markerByName = new Map();
let currentPopup = null;
/** @type {Array<object>} */
let currentList = [];
let communitiesRef = [];
let onSelect = () => {};

/**
 * Initialize the map. Must be called once at boot after index.html is in
 * the DOM. Returns true on success, false if we couldn't initialize (e.g.
 * missing Mapbox token) — callers should tolerate that and keep the list
 * view functional.
 *
 * @param {Array<object>} communities
 * @param {{ onSelect: (c: object) => void }} callbacks
 * @returns {boolean}
 */
export function initMap(communities, callbacks) {
  communitiesRef = communities;
  onSelect = callbacks.onSelect || (() => {});

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
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-82.62, 27.38],
    zoom: 11.5,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: LBK_BOUNDS,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

  map.on('load', () => {
    addZoneLabels();
    setCommunityFeatures(communities);
    wireClusterInteractions();
    syncMarkers(communities);
  });

  // Close popup + clear highlight when clicking empty map
  map.on('click', (e) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [CLUSTER_LAYER_ID],
    });
    if (!hits.length) {
      if (currentPopup) {
        currentPopup.remove();
        currentPopup = null;
      }
    }
  });

  return true;
}

function renderMapTokenNotice() {
  const el = document.getElementById('map');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:40px;text-align:center;color:#4A5A5E;font-family:Manrope,sans-serif;height:100%;display:flex;align-items:center;justify-content:center;">
      <div style="max-width:380px">
        <div style="font-family:Fraunces,serif;font-size:20px;margin-bottom:8px;color:#1A2628">Map unavailable</div>
        <p style="font-size:13px;margin:0">Set a Mapbox access token in <code>config.js</code> to enable the map. The filter panel and list view work without it.</p>
      </div>
    </div>`;
}

function addZoneLabels() {
  if (!map) return;
  map.addSource(ZONE_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: ZONE_LABELS.map((z) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [z.lng, z.lat] },
        properties: { label: z.label },
      })),
    },
  });
  map.addLayer({
    id: ZONE_LAYER_ID,
    type: 'symbol',
    source: ZONE_SOURCE_ID,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-letter-spacing': 0.18,
      'text-transform': 'uppercase',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#083638',
      'text-halo-color': 'rgba(255,255,255,0.9)',
      'text-halo-width': 2,
    },
  });
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
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 45,
  });

  // Cluster bubbles
  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#0E5254',
      'circle-opacity': 0.9,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2,
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        18, 5,
        22, 15,
        28,
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

  // Invisible hit layer for non-clustered points — we draw visible pins
  // via HTML markers (styled with .pin classes from map.css).
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
    const source = map.getSource(SOURCE_ID);
    source.getClusterExpansionZoom(clusterId, (err, zoom) => {
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
        properties: { name: c.name },
      })),
  };
}

/**
 * Sync HTML markers with the current filtered list. Uses one mapboxgl.Marker
 * per community so the teardrop .pin styling reuses unchanged.
 */
function syncMarkers(list) {
  if (!map) return;
  currentList = list;
  const desired = new Set(list.map((c) => c.name));

  // Remove markers no longer in the list
  markerByName.forEach((marker, name) => {
    if (!desired.has(name)) {
      marker.remove();
      markerByName.delete(name);
    }
  });

  // Add new markers
  list.forEach((c) => {
    if (markerByName.has(c.name)) return;
    const marker = buildMarker(c);
    marker.addTo(map);
    markerByName.set(c.name, marker);
  });
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
    openPopupFor(c);
    onSelect(c);
  });
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([c.lng, c.lat]);
}

function openPopupFor(c) {
  if (!map) return;
  if (currentPopup) currentPopup.remove();
  const html = `
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
 * Update the visible markers to match a new filtered list.
 */
export function renderMap(list) {
  if (!map) return;
  if (!map.isStyleLoaded()) {
    map.once('load', () => {
      setCommunityFeatures(list);
      syncMarkers(list);
    });
    return;
  }
  setCommunityFeatures(list);
  syncMarkers(list);
}

/**
 * Highlight/un-highlight a pin by community name. Safe to call when the
 * map isn't ready — it's a no-op if the marker doesn't exist yet.
 */
export function setHighlightedPin(name) {
  markerByName.forEach((marker, n) => {
    marker.getElement().classList.toggle('highlighted', n === name);
  });
}

/**
 * Fly to a community and open its popup. Used when a card is clicked.
 */
export function focusCommunity(community) {
  if (!map) return;
  map.flyTo({
    center: [community.lng, community.lat],
    zoom: Math.max(map.getZoom(), 14),
    duration: 650,
  });
  openPopupFor(community);
}

/**
 * Trigger a resize after the layout toggle changes the map container size.
 */
export function invalidateSize() {
  if (!map) return;
  // Wait for CSS transition to settle
  setTimeout(() => map.resize(), 120);
}
