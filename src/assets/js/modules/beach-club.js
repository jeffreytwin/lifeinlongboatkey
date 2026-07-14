/**
 * Bay Isles Beach Club explainer overlay.
 *
 * Communities carrying the "Beach Club Access" amenity get a tiny
 * "what's this?" link next to it in the details panel (list.js); clicking
 * it opens this overlay — a native rebuild of the site's Wix lightbox
 * (headline, YouTube explainer video, amenity grid with the uploaded
 * line icons in public/images/beach-club/).
 *
 * Embed behavior mirrors the photo lightbox (gallery.js): in an
 * auto-height iframe the page — and therefore the frame — can be
 * thousands of pixels tall, so a viewport-centered `position: fixed`
 * overlay would open far off the visitor's screen. The host element
 * streams the frame's visible slice; the overlay pins itself to that
 * window (tracking host scrolls live) over a full-frame backdrop.
 *
 * Copy is hardcoded on purpose: it changes rarely, and moving it to Wix
 * data is a follow-up for the live-fetch milestone.
 */

import { getHostViewport } from './embed-height.js';

/** The amenity value that gets the "what's this?" affordance. */
export const BEACH_CLUB_AMENITY = 'Beach Club Access';

const VIDEO_EMBED_URL =
  'https://www.youtube-nocookie.com/embed/uO0LHE7VC2w';

const ICON_DIR = '/images/beach-club/';

/** Overlay amenity grid — two columns, same order as the site lightbox. */
const CLUB_AMENITIES = [
  [
    { icon: 'private-beach-club-access.png', label: 'Private Beach Club Access' },
    { icon: 'private-beach-access.png', label: 'Private Beach Access' },
    { icon: 'barbecue-grills.png', label: 'Barbecue Grills / Stands' },
    { icon: 'covered-entertaining-area.png', label: 'Covered Entertaining Area' },
  ],
  [
    { icon: 'gated-entrances.png', label: 'Gated Entrances' },
    { icon: 'walking-paths.png', label: 'Walking Paths' },
    { icon: 'volleyball-court.png', label: 'Volleyball Court' },
  ],
];

function columnHtml(items) {
  return items
    .map(
      (a) => `
      <div class="bc-amenity">
        <img src="${ICON_DIR}${a.icon}" alt="" loading="lazy" />
        <span>${a.label}</span>
      </div>`,
    )
    .join('');
}

/** Open the Beach Club explainer. Closes on ✕, backdrop click, or Escape. */
export function openBeachClubOverlay() {
  const box = document.createElement('div');
  box.className = 'bc-overlay';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Bay Isles Beach Club Membership');
  box.innerHTML = `
    <div class="bc-card">
      <button type="button" class="bc-close" aria-label="Close">×</button>
      <h2 class="bc-title">Bay Isles <em>Beach Club Membership.</em></h2>
      <div class="bc-subtitle">An exclusive perk for those who live in Bay Isles communities</div>
      <div class="bc-video">
        <iframe src="${VIDEO_EMBED_URL}"
                title="Bay Isles Beach Club video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
      </div>
      <p class="bc-desc">The Beach Club gives Bay Isles residents private beach access without needing to live directly on the Gulf.</p>
      <div class="bc-amenities-label">Amenities Include:</div>
      <div class="bc-amenities">
        <div class="bc-amenities-col">${columnHtml(CLUB_AMENITIES[0])}</div>
        <div class="bc-amenities-col">${columnHtml(CLUB_AMENITIES[1])}</div>
      </div>
    </div>
  `;
  document.body.appendChild(box);
  // Same scroll lock the photo lightbox uses (body.lightbox-open).
  document.body.classList.add('lightbox-open');

  // Auto-height embed: pin the overlay to the host-visible slice of the
  // frame, with a full-frame backdrop behind it (see module docblock).
  let backdrop = null;
  const applyHostViewport = (v) => {
    if (!v || v.height <= 0) return;
    box.classList.add('is-windowed');
    box.style.top = v.top + 'px';
    box.style.height = v.height + 'px';
  };
  const onHostViewport = (e) => applyHostViewport(e.detail);
  if (getHostViewport()) {
    backdrop = document.createElement('div');
    backdrop.className = 'lightbox-backdrop';
    document.body.insertBefore(backdrop, box);
    applyHostViewport(getHostViewport());
    window.addEventListener('lbk-host-viewport', onHostViewport);
  }

  const close = () => {
    box.remove();
    if (backdrop) backdrop.remove();
    window.removeEventListener('lbk-host-viewport', onHostViewport);
    document.body.classList.remove('lightbox-open');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  box.querySelector('.bc-close').addEventListener('click', close);
  // Backdrop dismissal — only direct clicks on the dimmed area, not
  // anything inside the card.
  box.addEventListener('click', (e) => {
    if (e.target === box) close();
  });
  if (backdrop) backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}
