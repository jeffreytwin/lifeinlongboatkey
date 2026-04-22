/**
 * Data module — loads the static communities.json at boot.
 *
 * MVP uses a local static file. A follow-up will replace this with a live
 * @wix/data fetch (matching Parrish's api.js pattern) without changing callers.
 */

import communities from '../../../data/communities.json';
import neighborhoods from '../../../data/neighborhoods.geojson?raw';

const neighborhoodsGeoJson = JSON.parse(neighborhoods);

/**
 * @typedef {Object} Community
 * @property {string} name
 * @property {"condo"|"neighborhood"} type
 * @property {string} subtitle
 * @property {string} shortDescription
 * @property {string} priceRange
 * @property {string[]} priceTiers
 * @property {string} sqft
 * @property {string} bedrooms
 * @property {string[]} bedTags
 * @property {string[]} homeTypes
 * @property {string[]} amenities
 * @property {"north"|"mid"|"south"} location
 * @property {string[]} waterfront
 * @property {boolean} is55plus
 * @property {number} lat
 * @property {number} lng
 * @property {string} pageUrl
 */

/** @returns {Community[]} */
export function getCommunities() {
  return communities;
}

/** Returns the raw neighborhood polygon FeatureCollection. */
export function getNeighborhoodPolygons() {
  return neighborhoodsGeoJson;
}
