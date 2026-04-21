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

/** Escape a string for safe use inside an HTML attribute or text node. */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
