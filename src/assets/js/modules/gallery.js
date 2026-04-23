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
 */

import { escapeHtml, communityPhotoUrl } from './utils.js';

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
}
