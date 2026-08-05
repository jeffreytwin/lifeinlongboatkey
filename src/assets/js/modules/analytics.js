/**
 * GA4 event layer — a thin wrapper over the gtag() stub that index.html
 * defines on every host. The GA library itself only loads on
 * map.lifeinlongboatkey.com, so track() is safe to call unconditionally:
 * on local dev and the redirecting Firebase hostnames the calls land in a
 * dataLayer nobody reads. Events fire only on user interaction — nothing
 * here touches the load path.
 *
 * Event + param reference (and the GA4 console setup that goes with it)
 * lives in docs/analytics-events.md.
 */

// GA4 truncates string params at 100 chars; clamp ourselves so a long
// amenity combo degrades predictably instead of mid-word server-side.
const MAX_PARAM_LEN = 100;

let context = {};

/**
 * Merge params into the ambient context sent with every event. Used for
 * app_surface (set once at boot) and result_count (refreshed by apply()),
 * so reports can segment any event without stitching events together.
 */
export function setAnalyticsContext(params) {
  context = { ...context, ...params };
}

/** Fire a GA4 event. Null/undefined params are dropped, strings clamped. */
export function track(name, params = {}) {
  if (typeof window.gtag !== 'function') return;
  const clean = {};
  for (const [k, v] of Object.entries({ ...context, ...params })) {
    if (v == null) continue;
    clean[k] =
      typeof v === 'string' && v.length > MAX_PARAM_LEN
        ? v.slice(0, MAX_PARAM_LEN - 1) + '…'
        : v;
  }
  window.gtag('event', name, clean);
}

/** Standard identity params for events about a specific community. */
export function communityParams(c) {
  return {
    community_name: c.name,
    community_type: c.type,
    island_zone: c.location,
  };
}
