/**
 * Embed + deep-link support.
 *
 * The same app powers two surfaces:
 *   - The full interactive map at map.lifeinlongboatkey.com.
 *   - A focused, chrome-less version embedded in an <iframe> on each Wix
 *     community/location page (`?embed=1`), highlighting that one community.
 *
 * Both are driven by URL params:
 *   ?community=<slug>   focus this community (slug = the last segment of its
 *                       pageUrl, e.g. "the-islander-club" from
 *                       "/neighborhood/the-islander-club"). `?focus=` is accepted
 *                       as an alias.
 *   ?group=<slug>       a named cluster of communities (e.g. "bay-isles").
 *                       In an EMBED it hard-scopes the experience: only the
 *                       group's members render and the map fits its bounds —
 *                       for a community-specific landing page's mini-map.
 *                       On the FULL map it arrives as a clearable filter
 *                       instead (a "Showing: <cluster>" chip in the rail;
 *                       its ✕ or Clear All reveals the whole island).
 *   ?embed=1            collapse the chrome (header / filters / list) so the
 *                       map fills the frame and a single CTA links out to the
 *                       full map.
 *   ?embed=<slug>       single-param shorthand for ?embed=1&group=<slug>
 *                       (e.g. ?embed=bay-isles). Avoids a second '&'-joined
 *                       param, which some CMS URL fields — notably Wix's
 *                       "Website Address" embed — silently truncate.
 *
 * Campaign deep links (email buttons, social posts) — full map only:
 *   ?area=<zone>        pre-check that Location-on-Island filter and land
 *                       the map framed on the zone's pins. Zones: north /
 *                       mid / south, with north-end / mid-key / south-end
 *                       accepted as aliases.
 *   ?amenity=<slug>     pre-check amenity filter(s); slugified amenity
 *                       names, comma-separated for more than one
 *                       (e.g. ?amenity=beach-club-access).
 *   ?view=map|list      explicit arrival view; otherwise deep links land
 *                       on the map. Also lets a ?group= link pick its
 *                       arrival view (group visits default to the list).
 *
 * A deep link states fresh intent: on a normal navigation it overrides the
 * visitor's saved session filters. Back/forward returns still restore the
 * session (see main.js bootFull).
 */

const FULL_MAP_BASE = 'https://map.lifeinlongboatkey.com/';

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

/** Zone-id lookup for the ?area= deep link, aliases included. */
const AREA_ALIASES = {
  north: 'north',
  'north-end': 'north',
  northend: 'north',
  mid: 'mid',
  'mid-key': 'mid',
  midkey: 'mid',
  south: 'south',
  'south-end': 'south',
  southend: 'south',
};

/**
 * Read the campaign deep-link params off the current URL.
 * @returns {{ area: string|null, amenitySlugs: string[],
 *             view: string|null, any: boolean }}
 *   `area` is a canonical zone id (north/mid/south); `any` is true when the
 *   URL carries at least one deep-link param, i.e. it states fresh intent.
 */
export function getDeepLinkParams() {
  const p = new URLSearchParams(window.location.search);
  const area = AREA_ALIASES[norm(p.get('area'))] || null;
  const amenitySlugs = (p.get('amenity') || p.get('amenities') || '')
    .split(',')
    .map(norm)
    .filter(Boolean);
  const rawView = norm(p.get('view'));
  const view = rawView === 'map' || rawView === 'list' ? rawView : null;
  return { area, amenitySlugs, view, any: !!(area || amenitySlugs.length || view) };
}

/**
 * Resolve amenity slugs to the dataset's canonical amenity names, so a
 * deep link like ?amenity=beach-club-access seeds the same value the
 * filter checkboxes use. Unknown slugs are dropped silently — a stale
 * campaign link degrades to "no filter," never to zero results.
 */
export function resolveAmenities(communities, slugs) {
  if (!slugs || !slugs.length) return [];
  const bySlug = new Map();
  for (const c of communities) {
    for (const a of c.amenities || []) bySlug.set(slugifyName(a), a);
  }
  return slugs.map((s) => bySlug.get(s)).filter(Boolean);
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

/**
 * Full-app URL scoped to a group (e.g. ?group=bay-isles). This is the
 * standalone, top-level experience — full chrome, scoped + focused on the
 * group — that the mobile embed poster opens.
 */
export function groupMapUrl(groupSlug) {
  return groupSlug
    ? `${FULL_MAP_BASE}?group=${encodeURIComponent(groupSlug)}`
    : FULL_MAP_BASE;
}
