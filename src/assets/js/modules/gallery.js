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

import { escapeHtml, communityPhotoUrl } from './utils.js';

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
 * Render the gallery HTML for a community. Caller should append it to
 * the detail-content element before calling wireGallery(root) to attach
 * the click/keyboard handlers.
 */
export function galleryHtml(community) {
  const images = galleryImagesFor(community);
  const multi = images.length > 1;
  const slides = images
    .map(
      (url, i) => `
      <li class="gallery-slide${i === 0 ? ' is-active' : ''}" data-idx="${i}">
        <img src="${escapeHtml(url)}" alt="" ${i === 0 ? '' : 'loading="lazy"'} />
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
        .map((img) => img.getAttribute('src'))
        .filter(Boolean);
      openLightbox(images, current);
    });
  }
}

/**
 * Open a fullscreen lightbox over the current page showing `images`
 * starting at `startIndex`. Closes on backdrop click, the × button, or
 * Escape; navigates with arrow buttons or ←/→ keys.
 */
function openLightbox(images, startIndex) {
  if (!images.length) return;

  let idx = ((startIndex % images.length) + images.length) % images.length;
  const multi = images.length > 1;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">×</button>
    ${multi ? `<button type="button" class="lightbox-arrow lightbox-arrow-prev" aria-label="Previous image">‹</button>` : ''}
    <img class="lightbox-img" src="${escapeHtml(images[idx])}" alt="" />
    ${multi ? `<button type="button" class="lightbox-arrow lightbox-arrow-next" aria-label="Next image">›</button>` : ''}
    ${multi ? `<div class="lightbox-count" aria-live="polite">${idx + 1} / ${images.length}</div>` : ''}
  `;
  document.body.appendChild(box);
  document.body.classList.add('lightbox-open');

  const img = box.querySelector('.lightbox-img');
  const counter = box.querySelector('.lightbox-count');

  const update = (i) => {
    idx = ((i % images.length) + images.length) % images.length;
    img.src = images[idx];
    if (counter) counter.textContent = `${idx + 1} / ${images.length}`;
  };

  const close = () => {
    box.remove();
    document.body.classList.remove('lightbox-open');
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (multi && e.key === 'ArrowLeft') update(idx - 1);
    else if (multi && e.key === 'ArrowRight') update(idx + 1);
  };

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-arrow-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    update(idx - 1);
  });
  box.querySelector('.lightbox-arrow-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    update(idx + 1);
  });
  box.addEventListener('click', (e) => {
    // Click on the backdrop (not on the image / buttons) closes.
    if (e.target === box) close();
  });
  document.addEventListener('keydown', onKey);
}
