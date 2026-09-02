// Central business configuration.
// This is the single source of truth for company details and pricing.
// All pages/scripts should read from here rather than hardcoding values.
// The static price table on priser.html and the header/footer contact
// fallback text are the only places that also carry these values directly
// in HTML (needed so they work with JavaScript disabled and are crawlable
// by search engines) — keep those in sync with this file by hand.

export const BUSINESS = {
  name: 'Sirdal Renhold AS',
  orgNr: '934 822 706',
  phone: '+4746215212',
  phoneDisplay: '466 21 52 12',
  email: 'TODO', // TODO: faza 2 - venter på e-postadresse fra kunde
  url: 'https://sirdalrenhold.no',
  placeId: 'ChIJqbmZXV6hOUYR3ZE7eQfNtyY',
  openingHours: 'Mo-Su 07:00-22:00',
};

// Whether the prices below include Norwegian VAT (MVA).
export const PRICING_INCLUDES_VAT = false; // TODO: bekreft med kunde

// All pricing constants used by the calculator (assets/js/calculator.js)
// and mirrored in the static price table on priser.html.
// IMPORTANT: if you change a number here, update that table too - it is
// the only version search engines see, since the wizard itself is not
// crawlable.
export const PRICING = {
  cleaning: {
    standard: {
      key: 'standard',
      label: 'Standard vask',
      description: 'Hyttevask / daglig vask',
      rate: 10, // kr per m²
    },
    grundig: {
      key: 'grundig',
      label: 'Grundig vask',
      description: 'Flyttevask / utvask',
      rate: 70, // kr per m²
      includesWindows: true, // vinduspuss inne og ute er inkludert
      recommended: true,
    },
    byggvask: {
      key: 'byggvask',
      label: 'Byggvask',
      description: 'Etter oppussing',
      rate: 40, // kr per m²
    },
  },

  // TODO: venter på kunde - ingen priser for vindusvask ennå.
  // The structure is ready; fill in `price` (kr) per type once known.
  windows: {
    tiers: [
      { id: '1-10', min: 1, max: 10, label: '1–10 vinduer' },
      { id: '11-20', min: 11, max: 20, label: '11–20 vinduer' },
      { id: '21-30', min: 21, max: 30, label: '21–30 vinduer' },
      { id: '31-40', min: 31, max: 40, label: '31–40 vinduer' },
      { id: '41-50', min: 41, max: 50, label: '41–50 vinduer' },
    ],
    types: {
      enSide: { key: 'enSide', label: 'Én side', price: null }, // TODO: pris mangler
      komplett: { key: 'komplett', label: 'Komplett (begge sider)', price: null }, // TODO: pris mangler
    },
  },

  extras: {
    sengetoysett: { key: 'sengetoysett', label: 'Sengetøysett (leie)', unit: 'per person', price: 190 },
    vaskAvSengetoy: { key: 'vaskAvSengetoy', label: 'Vask av sengetøy', unit: 'per stk', price: 25 },
    starterPack: { key: 'starterPack', label: 'Starter pack', unit: 'engangs', price: 300 },
    paafyll: { key: 'paafyll', label: 'Påfyll', unit: 'fra', price: 100, isFrom: true },
  },

  flyttehjelp: {
    hourlyRate: 1100,
    // 10% discount applies only when Grundig cleaning is booked at the same time.
    discountWithGrundig: 0.10,
  },

  dodsbo: {
    // No fixed rate - always quoted after an on-site visit (befaring).
    note: 'Pris fastsettes etter befaring',
  },
};
