/**
 * <lbk-map-embed> — Wix Custom Element wrapper for the interactive map.
 *
 * Hosts the embed iframe and auto-sizes it: the app inside posts
 * { type: 'lbk-embed-height', height } messages (see
 * src/assets/js/modules/embed-height.js) and this element grows/shrinks
 * the iframe to match, so the host page extends with the content instead
 * of trapping it behind an inner scrollbar.
 *
 * Wix setup (Editor → Add Elements → Embed Code → Custom Element):
 *   Script URL : https://map.lifeinlongboatkey.com/embed-element.js
 *   Tag name   : lbk-map-embed
 *   Attributes : group="bay-isles"            (featured group embed)
 *                — or —
 *                community="islander-club"    (single-community embed)
 *   Optional   : min-height="480" max-height override (px; default cap 10000)
 *
 * Growth is applied immediately; shrinking is delayed half a second so
 * transient layout states (images loading, panel swaps) don't make the
 * page pump up and down.
 */
(function () {
  'use strict';

  var TAG = 'lbk-map-embed';
  var DEFAULT_BASE = 'https://map.lifeinlongboatkey.com/';
  var MESSAGE_TYPE = 'lbk-embed-height';

  if (!window.customElements || customElements.get(TAG)) return;

  class LbkMapEmbed extends HTMLElement {
    constructor() {
      super();
      this._iframe = null;
      this._height = 0;
      this._shrinkTimer = null;
      this._vpQueued = false;
      this._onMessage = this._onMessage.bind(this);
      this._onScroll = this._onScroll.bind(this);
    }

    static get observedAttributes() {
      return ['group', 'community', 'base'];
    }

    connectedCallback() {
      if (!this._iframe) {
        this.style.display = 'block';
        this.style.width = '100%';
        this.style.height = this._min() + 'px';
        var f = document.createElement('iframe');
        f.src = this._src();
        f.title = 'Longboat Key interactive map';
        f.loading = 'lazy';
        // Fullscreen must be granted by every ancestor frame — without
        // this, the YouTube player inside the app has its fullscreen
        // button silently denied. `*` delegates to the nested youtube.com
        // frame, not just the app's own origin.
        f.allowFullscreen = true;
        f.setAttribute('allow', 'fullscreen *; picture-in-picture *; autoplay');
        f.style.cssText =
          'display:block;width:100%;border:0;transition:height 0.25s ease;';
        f.style.height = this._min() + 'px';
        this._height = this._min();
        var self = this;
        // Ask for the current height once the app is up — closes any
        // boot-ordering race where its first report predates our listener.
        f.addEventListener('load', function () {
          try {
            var origin = new URL(f.src, location.href).origin;
            f.contentWindow.postMessage({ type: MESSAGE_TYPE + '-request' }, origin);
          } catch (_) {}
          self._sendViewport();
        });
        this._iframe = f;
        this.appendChild(f);
      }
      window.addEventListener('message', this._onMessage);
      // Stream the visible slice of the frame to the app so overlays
      // (the photo lightbox) can position within what's actually on
      // screen — `fixed` inside a page-tall iframe would center them
      // thousands of pixels off-screen otherwise.
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', this._onScroll);
    }

    disconnectedCallback() {
      window.removeEventListener('message', this._onMessage);
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onScroll);
      clearTimeout(this._shrinkTimer);
    }

    _onScroll() {
      if (this._vpQueued) return;
      this._vpQueued = true;
      var self = this;
      requestAnimationFrame(function () {
        self._vpQueued = false;
        self._sendViewport();
        self._fitWidth();
      });
    }

    /**
     * Mobile full-bleed: Wix's mobile layout can give the widget wrapper a
     * box narrower than the screen (e.g. 300px in a 320px viewport),
     * leaving a white strip beside the embed that no editor stretching
     * reliably removes. On small screens, break out of a narrower wrapper
     * to exactly the viewport width, aligned to the screen's left edge.
     * Desktop keeps normal in-column behavior.
     */
    _fitWidth() {
      try {
        var vw = document.documentElement.clientWidth;
        var wrap = this.parentElement;
        if (!wrap) return;
        var r = wrap.getBoundingClientRect();
        if (vw <= 860 && r.width && vw - r.width > 4) {
          this.style.width = vw + 'px';
          this.style.marginLeft = -r.left + 'px';
        } else {
          this.style.width = '100%';
          this.style.marginLeft = '';
        }
      } catch (_) {}
    }

    _sendViewport() {
      if (!this._iframe || !this._iframe.contentWindow) return;
      try {
        var r = this._iframe.getBoundingClientRect();
        var top = Math.max(0, -r.top);
        var bottom = Math.min(r.height, window.innerHeight - r.top);
        var origin = new URL(this._iframe.src, location.href).origin;
        this._iframe.contentWindow.postMessage(
          {
            type: MESSAGE_TYPE + '-viewport',
            top: Math.round(top),
            height: Math.round(Math.max(0, bottom - top)),
          },
          origin
        );
      } catch (_) {}
    }

    attributeChangedCallback() {
      if (this._iframe && this._iframe.src !== this._src()) {
        this._iframe.src = this._src();
      }
    }

    _src() {
      var url = new URL(this.getAttribute('base') || DEFAULT_BASE);
      var group = this.getAttribute('group');
      var community = this.getAttribute('community');
      if (group) {
        // Single-param shorthand (?embed=<group>) — see modules/embed.js.
        url.searchParams.set('embed', group);
      } else {
        url.searchParams.set('embed', '1');
        if (community) url.searchParams.set('community', community);
      }
      return url.toString();
    }

    _min() {
      return parseInt(this.getAttribute('min-height'), 10) || 480;
    }

    _max() {
      // The default cap is a runaway-feedback safety net, not a design
      // limit — real content (a details panel with 20+ listings) should
      // always unroll fully rather than scroll inside the frame.
      return parseInt(this.getAttribute('max-height'), 10) || 10000;
    }

    _onMessage(e) {
      if (!this._iframe || e.source !== this._iframe.contentWindow) return;
      // Only trust the origin we ourselves pointed the iframe at.
      var expected;
      try {
        expected = new URL(this._iframe.src, location.href).origin;
      } catch (_) {
        return;
      }
      if (e.origin !== expected) return;
      var d = e.data;
      if (!d) return;
      // The app asks for the frame's top when a details panel opens while
      // the visitor is scrolled deep into the list.
      if (d.type === MESSAGE_TYPE + '-scrolltop') {
        try {
          this.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
        return;
      }
      if (d.type !== MESSAGE_TYPE || typeof d.height !== 'number') return;

      var target = Math.max(this._min(), Math.min(this._max(), Math.round(d.height)));
      clearTimeout(this._shrinkTimer);
      if (target >= this._height) {
        this._apply(target);
      } else {
        // Shrink lazily so transient states don't pump the page height.
        var self = this;
        this._shrinkTimer = setTimeout(function () {
          self._apply(target);
        }, 500);
      }
    }

    _apply(h) {
      this._height = h;
      // Size the HOST element, not just the iframe. Wix pins an explicit
      // height on the custom element (the size drawn in the editor); if
      // only the inner iframe grew, it would be clipped inside that pinned
      // box and the page would never reflow. An inline height set here
      // overrides the pin, and Wix's layout engine then pushes the content
      // below down to make room.
      this.style.height = h + 'px';
      // Re-assert width on every apply — Wix rewrites inline sizes on its
      // own schedule. _fitWidth picks 100% (desktop, in-column) or a
      // viewport-wide breakout (mobile, narrow wrapper).
      this._fitWidth();
      if (this._iframe) this._iframe.style.height = h + 'px';
      // Wix additionally wraps every widget in a fixed-size `comp-…`
      // container that clips its contents. Release the nearest one so the
      // grown element can actually extend the section.
      try {
        var p = this.parentElement;
        for (var i = 0; p && i < 3; i++) {
          if (p.id && p.id.indexOf('comp-') === 0) {
            p.style.height = 'auto';
            p.style.minHeight = h + 'px';
            break;
          }
          p = p.parentElement;
        }
        // Nudge layouters that only re-measure on resize.
        window.dispatchEvent(new Event('resize'));
      } catch (_) {}
      // The frame's on-screen slice changed shape — refresh the app's copy.
      this._sendViewport();
    }
  }

  customElements.define(TAG, LbkMapEmbed);
})();
