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

/**
 * Hero-mode embed URL: autoplay, muted, no controls, minimal YouTube
 * chrome. Plays once — does not loop. playsinline keeps iOS from
 * taking the video fullscreen on autoplay.
 */
export function youtubeHeroEmbedUrl(url) {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    disablekb: '1',
    // enablejsapi lets us observe the playback state via the IFrame
    // Player API so the poster cover can fade exactly when PLAYING
    // starts (rather than on a blind timer).
    enablejsapi: '1',
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function youtubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:[^&]+&)*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/**
 * Best-effort thumbnail URL for a YouTube video — returns maxresdefault
 * (1280x720). maxresdefault isn't generated for every video; if it 404s,
 * swap to `/hqdefault.jpg` (always exists, 480x360) on error.
 */
export function youtubeThumbnailUrl(url) {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : null;
}
