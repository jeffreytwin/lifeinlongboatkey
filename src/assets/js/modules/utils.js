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
