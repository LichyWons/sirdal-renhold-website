// Netlify Function — Google Places proxy.
//
// SERVER-SIDE ONLY. Runs on Netlify, never in the browser. There is no
// `document`, no `window`, no `location` here — referencing any of them
// crashes the function on load.
//
// Save this as:  netlify/functions/reviews.mjs
// (The .mjs extension matters: without it Netlify treats the file as
// CommonJS and `export default` fails.)
//
// The API key must never reach the browser. This function is the only
// thing that holds it; the client calls the endpoint below and gets back
// a trimmed, safe payload.
//
// Setup:
//   1. Netlify → Site configuration → Environment variables
//   2. Add GOOGLE_PLACES_KEY for all deploy contexts
//   3. Restrict the key to Places API (New) in Google Cloud Console
//
// Caching: Google allows caching Places content for up to 30 days
// (place_id alone may be stored indefinitely). One day at the CDN keeps
// usage near zero and stays well inside that limit.

const PLACE_ID = 'ChIJqbmZXV6hOUYR3ZE7eQfNtyY'; // Sirdal Renhold AS

// Only the fields actually rendered. A narrower mask is also cheaper:
// Places API (New) bills by field group.
const FIELD_MASK = ['rating', 'userRatingCount', 'googleMapsUri', 'reviews'].join(',');

export default async () => {
  const key = process.env.GOOGLE_PLACES_KEY;

  if (!key) {
    return json({ error: 'missing_key' }, 500);
  }

  const url =
    `https://places.googleapis.com/v1/places/${PLACE_ID}` +
    `?languageCode=no&regionCode=NO`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      // Logged for debugging, not returned — error bodies can echo the key.
      console.error('[reviews] Google returned', res.status, detail);
      return json({ error: 'upstream', status: res.status }, 502);
    }

    const data = await res.json();

    // Reshape to exactly what the component needs. Field names match
    // assets/js/reviews.js: reviewCount, url.
    const payload = {
      rating: data.rating ?? null,
      reviewCount: data.userRatingCount ?? 0,
      mapsUrl: data.googleMapsUri ?? null,
      reviews: (data.reviews ?? [])
        .filter((r) => r.text?.text)
        .slice(0, 5)
        .map((r) => ({
          // Attribution is a licence condition, not decoration: author
          // name, photo and a link back to the review are all required.
          author: r.authorAttribution?.displayName ?? 'Google-bruker',
          avatar: r.authorAttribution?.photoUri ?? null,
          url: r.googleMapsUri ?? r.authorAttribution?.uri ?? null,
          rating: r.rating ?? null,
          text: r.text.text,
          published: r.relativePublishTimeDescription ?? null,
        })),
    };

    return json(payload, 200, {
      // Browser revalidates each time; the CDN serves a cached copy for
      // 24h and refreshes in the background. Roughly one upstream call
      // per day regardless of traffic.
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    });
  } catch (err) {
    console.error('[reviews] fetch failed', err);
    return json({ error: 'fetch_failed' }, 502);
  }
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}