/**
 * Image gallery — a lightweight swipable/clickable carousel used at the
 * top of the details panel.
 *
 * Data model on a community:
 *   images: string[]   — ordered list of image URLs. images[0] is primary.
 *   imageUrl: string   — legacy single-image override; used as a fallback
 *                        when `images` isn't present.
 *
 * When there's only one image the arrows and dots hide themselves so the
 * rendered output looks identical to a plain hero photo.
 *
 * On pointer devices (desktop), clicking the gallery opens a fullscreen
 * lightbox showing the same images with arrow/keyboard navigation. The
 * lightbox is skipped when there's only one image and on touch devices.
 */

import { escapeHtml, communityPhotoUrl, wixImageUrl, IMG_SIZES } from './utils.js';

const CAN_HOVER =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(hover: hover)').matches;

/**
 * Produce the ordered list of image URLs to display for a community.
 * Never returns an empty array — falls back to the type-appropriate
 * placeholder so the gallery always has something to show.
 */
export function galleryImagesFor(community) {
  const list = Array.isArray(community.images) ? community.images.filter(Boolean) : [];
  if (list.length) return list;
  return [communityPhotoUrl(community)];
}

/**
 * Lightbox image size, capped at the user's actual screen so a laptop
 * never downloads more pixels than it can show. Rounded up to a 320px
 * step so visitors with similar screens share the same CDN-cached
 * variant. IMG_SIZES.full is the upper bound.
 */
function lightboxImgSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.max(window.screen.width, window.screen.height) * dpr;
  const w = Math.min(IMG_SIZES.full.w, Math.ceil(px / 320) * 320);
  return { ...IMG_SIZES.full, w, h: w };
}

/**
 * Render the gallery HTML for a community. Caller should append it to
 * the detail-content element before calling wireGallery(root) to attach
 * the click/keyboard handlers.
 */
export function galleryHtml(community) {
  const images = galleryImagesFor(community);
  const multi = images.length > 1;
  // Slides render the hero-sized variant; the lightbox-quality URL rides
  // along in data-full so fullscreen view can show it uncropped.
  const fullSize = lightboxImgSize();
  const slides = images
    .map(
      (url, i) => `
      <li class="gallery-slide${i === 0 ? ' is-active' : ''}" data-idx="${i}">
        <img src="${escapeHtml(wixImageUrl(url, IMG_SIZES.hero))}"
             data-full="${escapeHtml(wixImageUrl(url, fullSize))}"
             alt="" decoding="async" ${i === 0 ? '' : 'loading="lazy"'} />
      </li>`,
    )
    .join('');
  const dots = multi
    ? `<div class="gallery-dots" role="tablist" aria-label="Gallery">
         ${images
           .map(
             (_, i) =>
               `<button class="gallery-dot${i === 0 ? ' is-active' : ''}"
                         type="button" data-idx="${i}"
                         role="tab" aria-label="Image ${i + 1} of ${images.length}"></button>`,
           )
           .join('')}
       </div>`
    : '';
  const arrows = multi
    ? `<button type="button" class="gallery-arrow gallery-arrow-prev" aria-label="Previous image">‹</button>
       <button type="button" class="gallery-arrow gallery-arrow-next" aria-label="Next image">›</button>`
    : '';
  return `
    <div class="detail-gallery ${community.type === 'condo' ? 'photo-condo' : 'photo-nbhd'}"
         data-count="${images.length}">
      <ul class="gallery-track">${slides}</ul>
      ${arrows}
      ${dots}
    </div>`;
}

/**
 * Attach interaction handlers to a gallery rendered by galleryHtml. Safe
 * to call on a rendered gallery that has only one image — it becomes a
 * no-op since there are no arrow/dot elements.
 */
export function wireGallery(root) {
  const gallery = root.querySelector('.detail-gallery');
  if (!gallery) return;
  const count = Number(gallery.dataset.count || 1);
  if (count < 2) return;

  let current = 0;
  const slides = gallery.querySelectorAll('.gallery-slide');
  const dots = gallery.querySelectorAll('.gallery-dot');

  const go = (i) => {
    current = (i + count) % count;
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === current));
    dots.forEach((d, idx) => {
      d.classList.toggle('is-active', idx === current);
      d.setAttribute('aria-selected', idx === current ? 'true' : 'false');
    });
  };

  gallery.querySelector('.gallery-arrow-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    go(current - 1);
  });
  gallery.querySelector('.gallery-arrow-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    go(current + 1);
  });
  dots.forEach((dot) =>
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      go(Number(dot.dataset.idx));
    }),
  );

  // Touch swipe — horizontal drag ≥40px advances/rewinds one slide.
  // Passive listeners so vertical scrolling on the panel isn't blocked.
  const SWIPE_THRESHOLD = 40;
  let touchStartX = 0;
  let touchStartY = 0;
  gallery.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );
  gallery.addEventListener(
    'touchend',
    (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Only treat mostly-horizontal gestures as swipes.
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) go(current + 1);
      else go(current - 1);
    },
    { passive: true },
  );

  // Desktop-only fullscreen lightbox. Touch devices already get the
  // swipe carousel inline; tapping to open a separate viewer would
  // collide with that gesture and feels redundant on a small screen.
  if (CAN_HOVER) {
    gallery.classList.add('is-zoomable');
    gallery.addEventListener('click', (e) => {
      // Arrows and dots already stopPropagation, so this click only
      // fires on the slide area itself.
      if (e.target.closest('.gallery-arrow, .gallery-dot')) return;
      const images = [...gallery.querySelectorAll('.gallery-slide img')]
        .map((img) => ({
          hero: img.getAttribute('src'),
          full: img.getAttribute('data-full') || img.getAttribute('src'),
        }))
        .filter((it) => it.hero && it.full);
      openLightbox(images, current);
    });
  }
}

/**
 * Open a fullscreen lightbox over the current page showing `images`
 * (array of { hero, full } URL pairs) starting at `startIndex`. Closes
 * on backdrop click, the × button, or Escape; navigates with arrow
 * buttons or ←/→ keys.
 *
 * Loading strategy: the hero variant is already in the browser cache
 * (the gallery just displayed it), so it paints instantly — slightly
 * blurred — while the full-resolution variant loads behind it and
 * sharpens in on arrival. Once the current image lands, its neighbors
 * are prefetched so arrowing through the gallery is instant. A small
 * spinner sits behind the image as a fallback for the cold-cache case
 * where even the hero hasn't painted yet.
 */
function openLightbox(images, startIndex) {
  if (!images.length) return;

  const count = images.length;
  const norm = (i) => ((i % count) + count) % count;
  let idx = norm(startIndex);
  const multi = count > 1;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">×</button>
    ${multi ? `<button type="button" class="lightbox-arrow lightbox-arrow-prev" aria-label="Previous image">‹</button>` : ''}
    <img class="lightbox-img" alt="" decoding="async" />
    ${multi ? `<button type="button" class="lightbox-arrow lightbox-arrow-next" aria-label="Next image">›</button>` : ''}
    ${multi ? `<div class="lightbox-count" aria-live="polite"></div>` : ''}
  `;
  document.body.appendChild(box);
  document.body.classList.add('lightbox-open');

  const img = box.querySelector('.lightbox-img');
  const counter = box.querySelector('.lightbox-count');

  // Full-res URLs that have finished downloading (so revisits skip the
  // blur-up) and ones already requested (so we never fetch twice).
  const loadedFull = new Set();
  const requested = new Set();

  const prefetch = (i) => {
    const url = images[norm(i)].full;
    if (requested.has(url)) return;
    requested.add(url);
    const im = new Image();
    im.onload = () => loadedFull.add(url);
    im.src = url;
  };

  // Guards against an out-of-order onload overwriting a newer slide
  // when the user arrows past a still-loading image.
  let token = 0;

  const show = (i) => {
    idx = norm(i);
    const t = ++token;
    const { hero, full } = images[idx];
    if (counter) counter.textContent = `${idx + 1} / ${count}`;

    if (full === hero || loadedFull.has(full)) {
      box.classList.remove('is-loading');
      img.classList.remove('is-preview');
      img.src = full;
      if (multi) { prefetch(idx + 1); prefetch(idx - 1); }
      return;
    }

    box.classList.add('is-loading');
    img.classList.add('is-preview');
    img.src = hero;
    requested.add(full);
    const loader = new Image();
    loader.onload = () => {
      loadedFull.add(full);
      if (t !== token) return;
      img.src = full;
      img.classList.remove('is-preview');
      box.classList.remove('is-loading');
      if (multi) { prefetch(idx + 1); prefetch(idx - 1); }
    };
    loader.onerror = () => {
      // Keep showing the hero rather than an empty frame.
      if (t === token) box.classList.remove('is-loading');
    };
    loader.src = full;
  };

  const close = () => {
    box.remove();
    document.body.classList.remove('lightbox-open');
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (multi && e.key === 'ArrowLeft') show(idx - 1);
    else if (multi && e.key === 'ArrowRight') show(idx + 1);
  };

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-arrow-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    show(idx - 1);
  });
  box.querySelector('.lightbox-arrow-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    show(idx + 1);
  });
  box.addEventListener('click', (e) => {
    // Click on the backdrop (not on the image / buttons) closes.
    if (e.target === box) close();
  });
  document.addEventListener('keydown', onKey);

  show(idx);
}
