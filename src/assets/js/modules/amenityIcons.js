/**
 * Amenity → icon URL map. Icons are the teal "on-state" variants
 * already hosted on Wix's CDN (sourced from docs/Neighborhoods &
 * Condos.csv "* Image" columns).
 *
 * STANDARD_AMENITIES is the ordered list of amenity values we'll render
 * in the details panel. The names here MUST match the Wix
 * `amenitiesTags` multi-select tag values exactly — when they drift
 * (e.g. "Marina Access" vs "Marina Nearby"), the renderer silently
 * drops the amenity. If you rename a Wix tag, update this list too.
 */

export const STANDARD_AMENITIES = [
  'Gated',
  'Beach Access',
  'Private Beach',
  'Beach Club Access',
  'Marina Nearby',
  'Boat Slips',
  'Tennis',
  'Pickleball',
  'Golf Nearby',
  'Community Pool',
  'Fitness Center',
  'Clubhouse',
  'Walking Paths',
  'Lifestyle Activities',
  'Lawn Maintenance Included',
];

export const AMENITY_ICONS = {
  'Gated':                     'https://static.wixstatic.com/media/d0be81_234c82554523485195ab6689a57cf5aa~mv2.png',
  'Beach Access':              'https://static.wixstatic.com/media/d0be81_c07b42f34e2a4b1b83ce9c7365ba08ee~mv2.png',
  'Private Beach':             'https://static.wixstatic.com/media/d0be81_46ae652738514710a481a38b3032ae41~mv2.png',
  'Beach Club Access':         'https://static.wixstatic.com/media/d0be81_ca847a223fc14b0898433985f2599191~mv2.png',
  'Marina Nearby':             'https://static.wixstatic.com/media/d0be81_7ae57d939a494935a9476fcf1805f9dd~mv2.png',
  'Boat Slips':                'https://static.wixstatic.com/media/d0be81_8465950e39e24080ad2609005e0a138f~mv2.png',
  'Tennis':                    'https://static.wixstatic.com/media/d0be81_d84d370cf9a24dd59fe8da8ad75c15ca~mv2.png',
  'Pickleball':                'https://static.wixstatic.com/media/d0be81_8a733845d473408090931a5837903aa6~mv2.png',
  'Golf Nearby':               'https://static.wixstatic.com/media/d0be81_ac1a2aefb8504191b3cd53ab5a3d56a5~mv2.png',
  'Community Pool':            'https://static.wixstatic.com/media/d0be81_04dc9ffa8b5c4eb8b04215c9d405eed1~mv2.png',
  'Fitness Center':            'https://static.wixstatic.com/media/d0be81_5385f628a79b4910b655a48c9723afb7~mv2.png',
  'Clubhouse':                 'https://static.wixstatic.com/media/d0be81_702628a4c0cb4fcfb1f3ea2513790259~mv2.png',
  'Walking Paths':             'https://static.wixstatic.com/media/d0be81_e00728427f0c47da8eed2bcb159ae24e~mv2.png',
  'Lifestyle Activities':      'https://static.wixstatic.com/media/d0be81_b1dde2a14e27418a8aeea0a59d16c896~mv2.png',
  'Lawn Maintenance Included': 'https://static.wixstatic.com/media/d0be81_8ac323e2678f458e8a3a38bea253c260~mv2.png',
};

/**
 * Amenity tag values we know about and deliberately don't render as a
 * chip in the detail panel — '55+ Community' is surfaced via the
 * dedicated is55plus flag, and the other two are deprecated taxonomy
 * variants kept here only so the sync's drift check doesn't flag them
 * on legacy records. Anything else not in STANDARD_AMENITIES will be
 * flagged by the sync as drift.
 */
export const KNOWN_NON_RENDERED_AMENITIES = new Set([
  '55+ Community',
  '55+Communities',
  'Private Beach (Deeded)',
  'Beach-Club Access',
]);

const STANDARD_SET = new Set(STANDARD_AMENITIES);
const ORDER = new Map(STANDARD_AMENITIES.map((a, i) => [a, i]));

/**
 * Filter a community's amenities array to the standard set and sort by
 * the canonical order defined above. Non-standard values (deprecated or
 * data-entry drift) are silently dropped.
 */
export function filteredAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];
  return amenities
    .filter((a) => STANDARD_SET.has(a))
    .sort((a, b) => ORDER.get(a) - ORDER.get(b));
}

/**
 * Site tag pills (public/images/tags/*) — the same colored pill art used
 * on the live site's Homes for Sale pages, reused on the rich embed list
 * cards. `communityTags` picks a card's corner tags by priority:
 * waterfront view first, then 55+, then the amenity list below in order.
 * Amenities consumed as tags are reported back (`used`) so the card's
 * chip row can skip them.
 */
const TAG_DIR = '/images/tags/';
/** [data value, image file, label] in corner-tag priority order. */
const AMENITY_TAG_PRIORITY = [
  ['Gated', 'gated.png', 'Gated'],
  ['Private Beach', 'private-beach.png', 'Private Beach'],
  ['Beach Club Access', 'beach-club.png', 'Beach Club'],
  ['Boat Slips', 'boat-slips.png', 'Boat Slips'],
  ['Golf Nearby', 'golf.png', 'Golf Nearby'],
  ['Tennis', 'tennis.png', 'Tennis'],
  ['Pickleball', 'pickleball.png', 'Pickleball'],
  ['Community Pool', 'community-pool.png', 'Community Pool'],
  ['Fitness Center', 'fitness-center.png', 'Fitness Center'],
  ['Clubhouse', 'clubhouse.png', 'Clubhouse'],
  ['Walking Paths', 'walking-paths.png', 'Walking Paths'],
  ['Lifestyle Activities', 'social-events.png', 'Social Events'],
];

const AMENITY_TAG_BY_VALUE = new Map(
  AMENITY_TAG_PRIORITY.map(([value, file, label]) => [value, { file, label }]),
);

/**
 * Per-community tag adjustments, keyed by community name: `prefer` jumps
 * those amenity tags to the front of the corner row; `suppress` keeps
 * those out of it (they fall back to the chip row). Editorial calls —
 * e.g. golf communities lead with Golf Nearby rather than the (near
 * universal in Bay Isles) Gated.
 */
const TAG_OVERRIDES = {
  'Grand Bay (Bay Isles)': { prefer: ['Golf Nearby'], suppress: ['Gated'] },
  'Weston Pointe (Bay Isles)': { prefer: ['Golf Nearby'], suppress: ['Gated'] },
};

/**
 * Up to `max` corner tags for a community.
 * @returns {{ tags: Array<{src: string, label: string}>, used: Set<string> }}
 */
export function communityTags(community, max = 3) {
  const tags = [];
  const used = new Set();
  const wf = community.waterfront || [];
  if (wf.includes('Gulf-front')) {
    tags.push({ src: `${TAG_DIR}gulf-view.png`, label: 'Gulf View' });
  } else if (wf.includes('Bay-front')) {
    tags.push({ src: `${TAG_DIR}bay-view.png`, label: 'Bay View' });
  }
  if (community.is55plus) {
    tags.push({ src: `${TAG_DIR}55-plus.png`, label: '55+' });
  }
  const amenities = new Set(community.amenities || []);
  const override = TAG_OVERRIDES[community.name] || {};
  const suppress = new Set(override.suppress || []);
  for (const value of override.prefer || []) {
    const t = AMENITY_TAG_BY_VALUE.get(value);
    if (!t || tags.length >= max || !amenities.has(value)) continue;
    tags.push({ src: TAG_DIR + t.file, label: t.label });
    used.add(value);
  }
  for (const [value, file, label] of AMENITY_TAG_PRIORITY) {
    if (tags.length >= max) break;
    if (used.has(value) || suppress.has(value)) continue;
    if (amenities.has(value)) {
      tags.push({ src: TAG_DIR + file, label });
      used.add(value);
    }
  }
  return { tags: tags.slice(0, max), used };
}

/**
 * Convert a community pageUrl (e.g. "/neighborhood/aquarius-club") to
 * the matching homes-for-sale URL on the live site
 * ("/neighborhood-homes-for-sale/aquarius-club"). Same slug, different
 * route prefix.
 */
export function homesForSaleUrl(pageUrl) {
  if (!pageUrl) return '';
  return pageUrl.replace(/^\/neighborhood\//, '/neighborhood-homes-for-sale/');
}
