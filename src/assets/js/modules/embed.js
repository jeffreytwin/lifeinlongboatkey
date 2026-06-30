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
 *   ?group=<slug>       restrict the embed to a named cluster of communities
 *                       (e.g. "bay-isles"). Only the group's members render
 *                       and the map fits its bounds — for a community-specific
 *                       landing page that wants a pre-filtered mini-map.
 *   ?embed=1            collapse the chrome (header / filters / list) so the
 *                       map fills the frame and a single CTA links out to the
 *                       full map.
 *   ?embed=<slug>       single-param shorthand for ?embed=1&group=<slug>
 *                       (e.g. ?embed=bay-isles). Avoids a second '&'-joined
 *                       param, which some CMS URL fields — notably Wix's
 *                       "Website Address" embed — silently truncate.
 */

const FULL_MAP_BASE = 'https://lifeinlongboatkey.web.app/';

/**
 * Named community groups for `?group=<slug>` embeds. Each entry is a slug →
 * { label, match } where match(community) decides membership. Adding a new
 * gated community / cluster (e.g. Longboat Key Club) is a one-line addition
 * here — no data changes. Matching by name substring is intentional: the
 * dataset names these consistently ("… (Bay Isles)", "Bay Isles - …"), and
 * no unrelated community collides on the phrase.
 */
const GROUPS = {
  'bay-isles': {
    label: 'Bay Isles',
    match: (c) => /bay isles/i.test(c.name || ''),
  },
};

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
 * @returns {{ embed: boolean, communitySlug: string|null, groupSlug: string|null }}
 */
export function getEmbedParams() {
  const p = new URLSearchParams(window.location.search);
  const raw = p.get('embed');
  const embed = raw !== null && raw !== '0' && raw !== 'false';
  const community = p.get('community') || p.get('focus');
  // Group can come from ?group=<slug>, or as the single-param shorthand
  // ?embed=<slug> — anything in the embed param that isn't a plain on/off
  // toggle is treated as a group slug. ?group= wins if both are present.
  const TOGGLE = new Set(['', '1', 'true', 'yes', 'on']);
  const embedShorthand =
    raw !== null && !TOGGLE.has(raw.toLowerCase()) ? raw : null;
  const group = p.get('group') || embedShorthand;
  return {
    embed,
    communitySlug: community ? norm(community) : null,
    groupSlug: group ? norm(group) : null,
  };
}

/**
 * Resolve a group slug to its definition, or null if unknown.
 * @returns {{ label: string, match: (c: object) => boolean }|null}
 */
export function findGroup(slug) {
  if (!slug) return null;
  return GROUPS[slug] || null;
}

/**
 * Return the communities belonging to a resolved group.
 * @param {Array<object>} communities
 * @param {{ match: (c: object) => boolean }|null} group
 * @returns {Array<object>}
 */
export function filterByGroup(communities, group) {
  if (!group) return [];
  return communities.filter((c) => group.match(c));
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
 * Counter Wix's mobile iframe upscale. On a Wix mobile page the embed is laid
 * out on a ~320px design canvas and scaled up to fill the device width, which
 * magnifies the UI (oversized chrome, drawer, list, detail). The iframe is
 * full-bleed there, so the visual scale ≈ device width ÷ the iframe's own
 * layout width — expose its inverse as the `--embed-scale` CSS variable, which
 * embed.css applies via `zoom` to the overlays / surfaces (never the Mapbox
 * canvas). No-ops to 1 when unscaled (desktop, or the embed opened directly),
 * and re-measures on resize / orientation change.
 *
 * The same formula is mirrored in index.html's head script so the chrome
 * doesn't flash full-size before this runs.
 */
/**
 * Deliberate extra reduction applied on top of the Wix-upscale compensation,
 * so the mobile embed chrome renders a bit smaller than the standalone app
 * (more breathing room for the map). 1 = match standalone; lower = smaller.
 * Mirrored in index.html's head script — keep them in sync.
 */
const EMBED_CHROME_SCALE = 0.8;

export function applyEmbedScale() {
  const root = document.documentElement;
  const compute = () => {
    const screenW = (window.screen && window.screen.width) || window.innerWidth;
    let scale = 1;
    // Only mobile-width, full-bleed iframes are upscaled. Clamp the measured
    // inverse so we never enlarge and don't over-shrink if the embed isn't
    // actually full-bleed, then apply the deliberate extra reduction.
    if (window.innerWidth <= 860 && screenW > 0) {
      scale = Math.max(0.7, Math.min(1, window.innerWidth / screenW)) * EMBED_CHROME_SCALE;
    }
    root.style.setProperty('--embed-scale', String(scale));
  };
  compute();
  window.addEventListener('resize', compute);
  window.addEventListener('orientationchange', compute);
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
