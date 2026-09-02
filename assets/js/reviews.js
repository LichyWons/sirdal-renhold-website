// Google reviews widget (index.html section 6).
//
// Fetches aggregated review data from a Netlify Function that does not
// exist yet - TODO: faza 3. The function is responsible for calling the
// Google Places API server-side and returning plain JSON; the Places API
// key must NEVER be shipped to the browser, so it must never appear in
// this file or any other client-side code.

import { BUSINESS } from './config.js';

const ENDPOINT = '/.netlify/functions/reviews'; // TODO: faza 3 - endepunktet finnes ikke ennå

// Placeholder data shown until the real endpoint exists, and as a fallback
// if the request fails. Deliberately obvious as placeholder text.
const PLACEHOLDER_DATA = {
  rating: 4.8,
  reviewCount: 27, // TODO: faza 3 - erstatt med ekte tall fra Google
  reviews: [
    {
      author: 'TODO: navn fra Google-anmeldelse',
      avatar: '/assets/img/avatar-placeholder.svg',
      rating: 5,
      text: 'TODO: venter på ekte anmeldelser fra Google-profilen.',
      url: `https://search.google.com/local/reviews?placeid=${BUSINESS.placeId}`,
    },
    {
      author: 'TODO: navn fra Google-anmeldelse',
      avatar: '/assets/img/avatar-placeholder.svg',
      rating: 5,
      text: 'TODO: venter på ekte anmeldelser fra Google-profilen.',
      url: `https://search.google.com/local/reviews?placeid=${BUSINESS.placeId}`,
    },
  ],
};

function starString(rating) {
  const full = Math.round(rating);
  return '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
}

function reviewCard(review) {
  return `
    <li class="review-card">
      <div class="review-head">
        <img class="review-avatar" src="${review.avatar}" alt="" width="34" height="34" loading="lazy">
        <p class="review-author">${review.author}</p>
      </div>
      <span class="review-stars" aria-hidden="true">${starString(review.rating)}</span>
      <p class="review-text">${review.text}</p>
      <a class="review-link" href="${review.url}" target="_blank" rel="noopener noreferrer">Se anmeldelsen på Google</a>
    </li>
  `;
}

function renderReviews(container, data) {
  const { rating, reviewCount, reviews } = data;
  container.innerHTML = `
    <div class="reviews-summary">
      <span class="reviews-stars" aria-hidden="true">${starString(rating)}</span>
      <span class="reviews-rating">${rating.toFixed(1)}</span>
      <span class="reviews-count">(${reviewCount} anmeldelser på Google)</span>
    </div>
    <ul class="reviews-slider" data-reviews-slider>
      ${reviews.slice(0, 5).map(reviewCard).join('')}
    </ul>
  `;
}

function renderLoading(container) {
  container.innerHTML = '<p class="reviews-loading">Laster anmeldelser …</p>';
}

export async function initReviews() {
  const container = document.querySelector('[data-reviews]');
  if (!container) return;

  renderLoading(container);

  try {
    const response = await fetch(ENDPOINT);
    if (!response.ok) throw new Error(`Reviews endpoint returned ${response.status}`);
    const data = await response.json();
    renderReviews(container, data);
  } catch (error) {
    // Endpoint does not exist yet (phase 3) - fall back to placeholder data.
    renderReviews(container, PLACEHOLDER_DATA);
  }
}
