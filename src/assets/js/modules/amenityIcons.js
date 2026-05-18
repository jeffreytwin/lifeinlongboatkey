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
 * Convert a community pageUrl (e.g. "/neighborhood/aquarius-club") to
 * the matching homes-for-sale URL on the live site
 * ("/neighborhood-homes-for-sale/aquarius-club"). Same slug, different
 * route prefix.
 */
export function homesForSaleUrl(pageUrl) {
  if (!pageUrl) return '';
  return pageUrl.replace(/^\/neighborhood\//, '/neighborhood-homes-for-sale/');
}
