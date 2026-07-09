/**
 * Embed auto-height — the iframe side of the Wix Custom Element handshake.
 *
 * An iframe can't resize itself, so the embed modes measure their natural
 * content height and post it to the host page:
 *
 *   window.parent.postMessage({ type: 'lbk-embed-height', height }, '*')
 *
 * public/embed-element.js (the <lbk-map-embed> custom element) listens and
 * sets the iframe's height, so the embed grows with its content instead of
 * scrolling internally — e.g. a details panel with 12 listings extends the
 * host page rather than fighting a fixed frame. Plain fixed-height iframe
 * embeds simply have no listener, so running this is always safe.
 *
 * Measurement is content-driven, never viewport-driven, to avoid feedback
 * loops (growing the iframe must not change what we report). A surface's
 * "natural" height is the distance from its scroll container's top edge to
 * the bottom of its lowest visible child plus the container's bottom
 * padding — immune to the container being stretched to 100% viewport.
 */

const MESSAGE_TYPE = 'lbk-embed-height';

/** The host-visible slice of this iframe, in frame coordinates — streamed
 *  by the host element (scroll/resize/growth) so overlays can position
 *  within what's actually on the visitor's screen. Null outside an
 *  auto-height embed (or before the first report arrives). */
let hostViewport = null;
export function getHostViewport() {
  return hostViewport;
}

/**
 * Post one explicit height to the host — used by surfaces with no natural
 * content height, like the mobile poster (an image that fills whatever it
 * gets). Width-derived values are safe; never derive from vh, which would
 * feed back through the resize.
 */
export function reportEmbedHeight(height) {
  if (window.parent === window) return;
  window.parent.postMessage(
    { type: MESSAGE_TYPE, height: Math.round(height) },
    '*'
  );
}

/**
 * Ask the auto-height host to bring the frame's top back on screen — used
 * when the details panel opens while the visitor is scrolled deep into the
 * list, so they land on the panel's top rather than its middle. No-op
 * without a listening host, or when the frame's top is already visible.
 */
export function scrollHostToTop() {
  if (window.parent === window) return;
  if (!hostViewport || hostViewport.top <= 0) return;
  window.parent.postMessage({ type: `${MESSAGE_TYPE}-scrolltop` }, '*');
}

/** Natural (content-driven) height of a scroll container, or 0 when the
 *  element is missing or display:none. */
function naturalHeight(container) {
  if (!container) return 0;
  const cRect = container.getBoundingClientRect();
  if (cRect.width === 0 && cRect.height === 0) return 0; // display:none
  let bottom = cRect.top;
  for (const child of container.children) {
    const r = child.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // hidden (e.g. mobile-only)
    // Rects exclude margins, but bottom margins still extend the scroll
    // range (e.g. each list card carries margin-bottom).
    const mb = parseFloat(getComputedStyle(child).marginBottom) || 0;
    if (r.bottom + mb > bottom) bottom = r.bottom + mb;
  }
  const padBottom = parseFloat(getComputedStyle(container).paddingBottom) || 0;
  return Math.max(0, bottom - cRect.top + container.scrollTop + padBottom);
}

/** The height the embed wants: the tallest of ALL visible surfaces — the
 *  filter rail, the list, and the details panel when open. The list stays
 *  in the measurement while a panel is open because it remains on screen
 *  beside it (desktop layout-detail): a short panel must not shrink the
 *  frame under the list and hand it back an internal scrollbar. Hidden
 *  surfaces measure 0, and the map has no natural height — a map-only
 *  report of 0 lets the host element fall back to its min-height. */
function desiredHeight() {
  const detailOpen = document
    .getElementById('content')
    ?.classList.contains('layout-detail');
  const listVisible = document.body.classList.contains('view-list');
  // Map view (no list, no panel): a map has no natural height — pick a
  // pleasant frame from the width instead of inheriting the filter
  // rail's full height (the rail scrolls internally, as it does in the
  // standalone app). Width-derived, so no resize feedback.
  if (!detailOpen && !listVisible) {
    return Math.min(940, Math.max(520, Math.round(window.innerWidth * 0.58)));
  }
  const list = naturalHeight(document.querySelector('.list-view'));
  const panel = detailOpen
    ? naturalHeight(document.querySelector('.detail-panel'))
    : 0;
  const filters = naturalHeight(document.querySelector('.filters'));
  const h = Math.ceil(Math.max(list, panel, filters));
  // Small allowance for nested trailing margins (e.g. the last list card's
  // margin-bottom inside the ul), which rect walks can't see.
  return h > 0 ? h + 20 : 0;
}

/**
 * Start posting height reports to the host page. Call once at boot from
 * the embed modes (no-op when the app isn't inside an iframe).
 */
export function startEmbedHeightReporting() {
  if (window.parent === window) return; // not embedded — nothing to talk to

  let lastSent = -1;
  let timer = null;
  let notReadyRetries = 20;
  const measureAndPost = () => {
    timer = null;
    const h = desiredHeight();
    // A tiny measurement before anything has been posted means layout
    // isn't live yet (e.g. a render-blocking stylesheet still pending —
    // every rect reads 0). Don't post garbage; poll until it settles.
    // (A map-only minimal embed also lands here and simply never posts,
    // which is right — the host element then keeps its min-height.)
    if (h < 100 && lastSent === -1) {
      if (notReadyRetries-- > 0) timer = setTimeout(measureAndPost, 300);
      return;
    }
    if (Math.abs(h - lastSent) <= 1) return;
    lastSent = h;
    window.parent.postMessage({ type: MESSAGE_TYPE, height: h }, '*');
  };
  // Coalesce bursts with a short timer, NOT requestAnimationFrame — rAF is
  // starved in background tabs and unpainted iframes, which would swallow
  // the boot report until the user first interacts.
  const report = () => {
    if (timer === null) timer = setTimeout(measureAndPost, 50);
  };
  // A measurement taken this instant, discarding any queued (possibly
  // pre-CSS, mid-layout) one.
  const reportFresh = () => {
    lastSent = -1;
    clearTimeout(timer);
    timer = null;
    report();
  };

  // Everything that changes content size funnels into one rAF-coalesced
  // report: the layout-detail class swap, list re-renders on filter
  // changes, and late-loading images (ResizeObserver catches those).
  const mo = new MutationObserver(report);
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(report);
    ['.list-view-items', '#detailContent', '.filters'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    });
  }
  window.addEventListener('load', report);
  // Width changes move the map-view height and reflow the cards; the
  // observers only see DOM changes, so listen for resize directly.
  window.addEventListener('resize', report);

  // Handshake: the host element pings once its iframe has loaded (and any
  // time it wants a refresh), so a report posted before the host was
  // listening — or lost to any other boot-ordering race — gets re-sent.
  // It also streams the host-visible slice of the frame (see above).
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d) return;
    if (d.type === `${MESSAGE_TYPE}-request`) {
      reportFresh();
    } else if (
      d.type === `${MESSAGE_TYPE}-viewport` &&
      typeof d.top === 'number' &&
      typeof d.height === 'number'
    ) {
      hostViewport = { top: d.top, height: d.height };
      window.dispatchEvent(new CustomEvent('lbk-host-viewport', { detail: hostViewport }));
    }
  });

  report();
  // Staggered boot re-checks: the first measurement can land mid-layout
  // (stylesheets/fonts still applying), and if the map then sits idle no
  // observer ever fires again to correct it. lastSent dedupes, so these
  // are free when the first report was already right.
  [300, 1000, 2500].forEach((ms) => setTimeout(report, ms));
}
