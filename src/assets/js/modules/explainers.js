/**
 * Amenity explainer overlays.
 *
 * Some amenities deserve a story, not just a checkmark. Amenities listed
 * in EXPLAINERS get a tiny link next to them in the details panel
 * (list.js) — "what's this?" for Beach Club Access, "how can I play?"
 * for Golf Nearby — that opens a native rebuild of the site's matching
 * Wix lightbox: headline, YouTube explainer video, and a two-column
 * feature grid using the uploaded teal line icons.
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

const BC_ICONS = '/images/beach-club/';
const GOLF_ICON = '/images/explainers/golf.png';

/**
 * Amenity value → explainer definition. `linkLabel` is the inline link
 * text list.js renders next to the amenity; everything else shapes the
 * overlay. Optional fields: topIcon, listLabel, footnote, cta.
 */
export const EXPLAINERS = {
  'Beach Club Access': {
    linkLabel: 'what’s this?',
    ariaLabel: 'Bay Isles Beach Club Membership',
    titleHtml:
      '<span class="bc-t-teal">Bay Isles</span> <span class="bc-t-coral">Beach Club Membership.</span>',
    subtitle: 'An exclusive perk for those who live in Bay Isles communities',
    videoUrl: 'https://www.youtube-nocookie.com/embed/uO0LHE7VC2w',
    videoTitle: 'Bay Isles Beach Club video',
    desc: 'The Beach Club gives Bay Isles residents private beach access without needing to live directly on the Gulf.',
    listLabel: 'Amenities Include:',
    columns: [
      [
        { icon: `${BC_ICONS}private-beach-club-access.png`, label: 'Private Beach Club Access' },
        { icon: `${BC_ICONS}private-beach-access.png`, label: 'Private Beach Access' },
        { icon: `${BC_ICONS}barbecue-grills.png`, label: 'Barbecue Grills / Stands' },
        { icon: `${BC_ICONS}covered-entertaining-area.png`, label: 'Covered Entertaining Area' },
      ],
      [
        { icon: `${BC_ICONS}gated-entrances.png`, label: 'Gated Entrances' },
        { icon: `${BC_ICONS}walking-paths.png`, label: 'Walking Paths' },
        { icon: `${BC_ICONS}volleyball-court.png`, label: 'Volleyball Court' },
      ],
    ],
  },
  'Golf Nearby': {
    linkLabel: 'how can I play?',
    ariaLabel: 'Play Golf in Longboat Key',
    topIcon: GOLF_ICON,
    titleHtml:
      '<span class="bc-t-coral">Play Golf in</span> <span class="bc-t-teal">Longboat Key.</span>',
    subtitle:
      'Gain access to 45 exclusive holes across the island when you join the Longboat Key Club.',
    videoUrl: 'https://www.youtube-nocookie.com/embed/Cd1__4nx9AE',
    videoTitle: 'Longboat Key Club golf video',
    desc: 'Longboat Key Club offers the island’s primary golf experience, with access generally reserved for club members and resort guests.',
    columns: [
      [
        { icon: GOLF_ICON, label: 'Links on Longboat Course' },
        { icon: GOLF_ICON, label: 'Driving Ranges' },
        { icon: GOLF_ICON, label: 'Private Clubhouses' },
      ],
      [
        { icon: GOLF_ICON, label: 'Harbourside Golf Course' },
        { icon: GOLF_ICON, label: 'Full-Service Pro Shops' },
        { icon: GOLF_ICON, label: 'Indoor and Outdoor Dining' },
      ],
    ],
    footnote: 'And much more',
    cta: { label: 'Learn More', href: 'https://www.lifeinlongboatkey.com/the-longboat-key-club' },
  },
};

function columnHtml(items) {
  return items
    .map(
      (a) => `
      <div class="bc-amenity">
        <img src="${a.icon}" alt="" loading="lazy" />
        <span>${a.label}</span>
      </div>`,
    )
    .join('');
}

/**
 * Open the explainer overlay for an amenity in EXPLAINERS (no-op for
 * anything else). Closes on ✕, backdrop click, or Escape.
 */
export function openExplainer(amenity) {
  const def = EXPLAINERS[amenity];
  if (!def) return;

  const box = document.createElement('div');
  box.className = 'bc-overlay';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', def.ariaLabel);
  box.innerHTML = `
    <div class="bc-card">
      <button type="button" class="bc-close" aria-label="Close">×</button>
      ${def.topIcon ? `<img class="bc-topicon" src="${def.topIcon}" alt="" />` : ''}
      <h2 class="bc-title">${def.titleHtml}</h2>
      <div class="bc-subtitle">${def.subtitle}</div>
      <div class="bc-video">
        <iframe src="${def.videoUrl}"
                title="${def.videoTitle}"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
      </div>
      <p class="bc-desc">${def.desc}</p>
      ${def.listLabel ? `<div class="bc-amenities-label">${def.listLabel}</div>` : ''}
      <div class="bc-amenities">
        <div class="bc-amenities-col">${columnHtml(def.columns[0])}</div>
        <div class="bc-amenities-col">${columnHtml(def.columns[1])}</div>
      </div>
      ${def.footnote ? `<div class="bc-footnote">${def.footnote}</div>` : ''}
      ${def.cta ? `<a class="bc-cta" href="${def.cta.href}" target="_top">${def.cta.label}</a>` : ''}
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
