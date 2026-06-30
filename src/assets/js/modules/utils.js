/**
 * Small cross-module helpers.
 */

export const LOCATION_LABELS = {
  north: 'North End',
  mid: 'Mid-Key',
  south: 'South End',
};

export function locationLabel(loc) {
  return LOCATION_LABELS[loc] || loc;
}

/**
 * Sum counts for a field across the community list.
 *
 * Mirrors countsBy() from the mockup (lines 634–640).
 *
 * @param {Array<object>} communities
 * @param {string} field
 * @param {boolean} isArrayField
 * @returns {Record<string, number>}
 */
export function countsBy(communities, field, isArrayField = false) {
  const counts = {};
  communities.forEach((c) => {
    const vals = isArrayField ? c[field] : [c[field]];
    vals.forEach((v) => {
      if (v === undefined || v === null) return;
      counts[v] = (counts[v] || 0) + 1;
    });
  });
  return counts;
}

/**
 * Resolve a photo URL for a community. Falls back to a per-type stand-in
 * until real photos are supplied. Set `imageUrl` on a community record to
 * override for that one community.
 */
export function communityPhotoUrl(c) {
  if (c.imageUrl) return c.imageUrl;
  return c.type === 'condo'
    ? '/images/placeholder-condo.jpg'
    : '/images/placeholder-neighborhood.jpg';
}

/**
 * Standard image sizes, sized at 2× their largest rendered box so they
 * stay crisp on retina displays. Reusing the same preset across surfaces
 * (cards, hover card, popup) means the browser fetches each photo once
 * and serves the rest from cache.
 */
export const IMG_SIZES = {
  card: { w: 640, h: 480 },
  hero: { w: 880, h: 440 },
  listing: { w: 800, h: 500 },
  full: { w: 1920, h: 1920, q: 85, mode: 'fit' },
};

const WIX_MEDIA_RE = /^https:\/\/static\.wixstatic\.com\/media\/([^/?#]+)/;

/**
 * Rewrite a Wix media URL to a CDN-resized variant. A bare
 * `…/media/<id>~mv2.jpg` URL serves the original multi-MB upload; appending
 * a transform path makes Wix's CDN resize/re-encode on the fly (`enc_auto`
 * negotiates WebP/AVIF). Non-Wix URLs (e.g. local placeholders) pass
 * through untouched.
 *
 * `mode: 'fill'` (default) center-crops to exactly w×h — right for
 * object-fit:cover thumbnails. `mode: 'fit'` bounds the image within w×h
 * without cropping — right for the lightbox.
 */
export function wixImageUrl(url, { w, h, q = 80, mode = 'fill' } = {}) {
  if (typeof url !== 'string' || !w || !h) return url;
  const m = url.match(WIX_MEDIA_RE);
  if (!m) return url;
  const op = mode === 'fit' ? 'fit' : 'fill';
  const crop = op === 'fill' ? ',al_c' : '';
  return `https://static.wixstatic.com/media/${m[1]}/v1/${op}/w_${w},h_${h}${crop},q_${q},enc_auto/${m[1]}`;
}

/** Card/list/hover-sized photo for a community (cache-friendly shared size). */
export function communityThumbUrl(c) {
  return wixImageUrl(communityPhotoUrl(c), IMG_SIZES.card);
}

/** Escape a string for safe use inside an HTML attribute or text node. */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract a YouTube video ID from any of the common URL forms and return
 * an embed URL, or null if the input isn't a recognizable YouTube link.
 * Handles watch, short (youtu.be), embed, and Shorts URLs.
 */
export function youtubeEmbedUrl(url) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:[^&]+&)*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/**
 * Mapbox Static Images URL for a small reference map showing where a
 * community sits. Returns null if the public token isn't configured or
 * the community has no coordinate — callers should omit the map block
 * in that case.
 */
export function staticMapUrl(community, { width = 400, height = 200, zoom = 14 } = {}) {
  const token = typeof window !== 'undefined' ? window.config?.mapboxAccessToken : null;
  if (!token || token === 'pk.dummy' || token === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') return null;
  if (typeof community?.lat !== 'number' || typeof community?.lng !== 'number') return null;
  // URL-encoded color works without the hash.
  const color = community.type === 'condo' ? '0E5254' : 'E47A5C';
  const { lng, lat } = community;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `pin-l+${color}(${lng},${lat})/${lng},${lat},${zoom}/${width}x${height}@2x` +
    `?access_token=${encodeURIComponent(token)}`
  );
}

/**
 * Static Mapbox image of a set of communities — a marker per community, with
 * `auto` framing so the whole cluster is in view. Used for the mobile embed
 * poster. Returns null when there's no token or no placeable communities.
 * (No @2x: keeps each dimension under Mapbox's 1280px static-image limit.)
 */
export function staticMapForGroup(communities, { width = 640, height = 900 } = {}) {
  const token = typeof window !== 'undefined' ? window.config?.mapboxAccessToken : null;
  if (!token || token === 'pk.dummy' || token === 'YOUR_MAPBOX_ACCESS_TOKEN_HERE') return null;
  const pts = (communities || []).filter(
    (c) => typeof c?.lat === 'number' && typeof c?.lng === 'number',
  );
  if (!pts.length) return null;
  const overlays = pts
    .map((c) => `pin-s+${c.type === 'condo' ? '1F6B5A' : 'E07A1A'}(${c.lng},${c.lat})`)
    .join(',');
  return (
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/` +
    `${overlays}/auto/${width}x${height}` +
    `?access_token=${encodeURIComponent(token)}&padding=50`
  );
}
