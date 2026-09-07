// Google reviews widget (index.html section 6).
//
// Fetches aggregated review data from a Netlify Function. The Places API
// key is held server-side only and must never appear in this file or any
// other client-side code.
//
// Two rules this file exists to enforce:
//
//   1. Review text, author names and avatar URLs are third-party content.
//      They are inserted with textContent and property assignment, never
//      innerHTML. This is the only thing standing between a Google review
//      and script execution on the client's site.
//
//   2. Placeholder data renders on localhost only. On production a failed
//      request removes the section entirely. Showing invented ratings to
//      customers of a cleaning company is a misrepresentation the client
//      would answer for, not us.

const ENDPOINT = '/.netlify/functions/reviews';

const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);

// Development scaffolding. Deliberately obvious, never shipped to users.
const PLACEHOLDER_DATA = {
  rating: 5,
  reviewCount: 23,
  reviews: [
    {
      author: 'TODO: navn fra Google',
      avatar: '/assets/img/avatar-placeholder.svg',
      rating: 5,
      text: 'TODO: venter på ekte anmeldelser fra Google-profilen.',
      url: null,
    },
    {
      author: 'TODO: navn fra Google',
      avatar: '/assets/img/avatar-placeholder.svg',
      rating: 5,
      text: 'TODO: venter på ekte anmeldelser fra Google-profilen.',
      url: null,
    },
  ],
};

function starString(rating) {
  const full = Math.round(rating ?? 0);
  return '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
}

function formatRating(rating) {
  // nb-NO uses a decimal comma: 5,0 — not 5.0
  return new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function reviewCard(review) {
  const item = el('li', 'review-card');
  const head = el('div', 'review-head');

  if (review.avatar) {
    const img = el('img', 'review-avatar');
    img.src = review.avatar;
    img.alt = '';
    img.width = 34;
    img.height = 34;
    img.loading = 'lazy';
    // Google avatar hosts reject requests that carry a referrer.
    img.referrerPolicy = 'no-referrer';
    head.append(img);
  }

  head.append(el('p', 'review-author', review.author));
  item.append(head);

  if (review.rating) {
    const stars = el('span', 'review-stars', starString(review.rating));
    stars.setAttribute('aria-label', `${review.rating} av 5 stjerner`);
    item.append(stars);
  }

  item.append(el('p', 'review-text', review.text));

  // Attribution is a licence condition: author name, avatar and a link
  // back to the review on Google.
  if (review.url) {
    const link = el('a', 'review-link', 'Se anmeldelsen på Google');
    link.href = review.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
  }

  return item;
}

function renderReviews(container, data) {
  const { rating, reviewCount, reviews } = data;

  const summary = el('div', 'reviews-summary');

  const stars = el('span', 'reviews-stars', starString(rating));
  stars.setAttribute('aria-hidden', 'true');
  summary.append(stars);

  summary.append(el('span', 'reviews-rating', formatRating(rating)));
  summary.append(
    el('span', 'reviews-count', `(${reviewCount} anmeldelser på Google)`)
  );

  const list = el('ul', 'reviews-slider');
  list.setAttribute('data-reviews-slider', '');
  list.append(...reviews.slice(0, 5).map(reviewCard));

  container.replaceChildren(summary, list);
  container.removeAttribute('data-loading');
}

function renderLoading(container) {
  container.replaceChildren(el('p', 'reviews-loading', 'Laster anmeldelser …'));
}

export async function initReviews() {
  const container = document.querySelector('[data-reviews]');
  if (!container) return;

  renderLoading(container);

  try {
    const response = await fetch(ENDPOINT);
    if (!response.ok) throw new Error(`Reviews endpoint returned ${response.status}`);

    const data = await response.json();
    if (!data.reviews?.length) throw new Error('No reviews returned');

    renderReviews(container, data);
  } catch (error) {
    if (IS_LOCAL) {
      console.warn('[reviews] falling back to placeholder data:', error);
      renderReviews(container, PLACEHOLDER_DATA);
      return;
    }

    // Production: drop the section rather than show an error box or,
    // worse, invented ratings.
    const section = container.closest('section') ?? container;
    section.remove();
  }
}