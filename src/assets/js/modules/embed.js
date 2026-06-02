/**
 * Embed + deep-link support.
 *
 * The same app powers two surfaces:
 *   - The full interactive map at lifeinlongboatkey.web.app.
 *   - A focused, chrome-less version embedded in an <iframe> on each Wix
 *     community/location page (`?embed=1`), highlighting that one community.
 *
 * Both are driven by URL params:
 *   ?community=<slug>   focus this community (slug = the last segment of its
 *                       pageUrl, e.g. "islander-club" from
 *                       "/neighborhood/islander-club"). `?focus=` is accepted
 *                       as an alias.
 *   ?embed=1            collapse the chrome (header / filters / list) so the
 *                       map fills the frame and a single CTA links out to the
 *                       full map.
 */

const FULL_MAP_BASE = 'https://lifeinlongboatkey.web.app/';

/** Trim leading/trailing slashes and lowercase. */
function norm(s) {
  return (s || '').toLowerCase().replace(/^\/+|\/+$/g, '');
}

/** Last path segment of a pageUrl, normalized — the canonical embed slug. */
function slugFromPageUrl(pageUrl) {
  return norm(pageUrl).split('/').pop() || '';
}

/** Slugify a community name as a fallback join key. */
function slugifyName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Read the embed/deep-link params off the current URL.
 * @returns {{ embed: boolean, communitySlug: string|null }}
 */
export function getEmbedParams() {
  const p = new URLSearchParams(window.location.search);
  const raw = p.get('embed');
  const embed = raw !== null && raw !== '0' && raw !== 'false';
  const community = p.get('community') || p.get('focus');
  return { embed, communitySlug: community ? norm(community) : null };
}

/**
 * Resolve a slug to a community record. Matches on the pageUrl's last
 * segment first, then falls back to a slugified name match.
 * @returns {object|null}
 */
export function findCommunityBySlug(communities, slug) {
  if (!slug) return null;
  return (
    communities.find((c) => slugFromPageUrl(c.pageUrl) === slug) ||
    communities.find((c) => slugifyName(c.name) === slug) ||
    null
  );
}

/**
 * Build the "open the full map" URL for the embed CTA, pre-focused on the
 * given community when there is one.
 */
export function fullMapUrl(target) {
  if (!target) return FULL_MAP_BASE;
  const slug = slugFromPageUrl(target.pageUrl) || slugifyName(target.name);
  return slug
    ? `${FULL_MAP_BASE}?community=${encodeURIComponent(slug)}`
    : FULL_MAP_BASE;
}
