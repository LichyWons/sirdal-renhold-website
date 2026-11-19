// Central business configuration.
// This is the single source of truth for company details and pricing.
// All pages/scripts should read from here rather than hardcoding values.
// The static price table on priser.html and the header/footer contact
// fallback text are the only places that also carry these values directly
// in HTML (needed so they work with JavaScript disabled and are crawlable
// by search engines) — keep those in sync with this file by hand.
//
// Sync checklist before launch:
//   1. priser.html static table matches PRICING
//   2. index.html + tjenester.html service cards match PRICING
//   3. tjenester/hyttevask.html and tjenester/flyttevask.html body text,
//      FAQ answers and Service schema
//   4. footer org.nr and phone match BUSINESS

export const BUSINESS = {
  name: 'Sirdal Renhold AS',
  orgNr: '934 822 706',
  phone: '+4746215212',
  // Norwegian mobile numbers group 3-2-3.
  phoneDisplay: '462 15 212',
  // Found on the old sirdalrenhold.no. Guard every use with
  // `if (BUSINESS.email)` so a missing address never renders mailto:TODO.
  email: 'post@sirdalrenhold.no', // TODO: bekreft med kunde
  url: 'https://sirdalrenhold.no',
  placeId: 'ChIJqbmZXV6hOUYR3ZE7eQfNtyY',
  openingHours: 'Mo-Su 07:00-22:00',
  // Service-area business: the Google profile carries no public address,
  // so schema.org uses areaServed instead of PostalAddress.
  areaServed: ['Sirdal', 'Tjørhom'], // TODO: bekreft med kunde
};

// Every price below is a final customer price including MVA, per the
// client's notes of 20 Oct 2026. Nothing in the UI adds or subtracts VAT.
export const PRICING_INCLUDES_VAT = true;

// ---------------------------------------------------------------------
// Pricing — client-confirmed, 20 Oct 2026
// ---------------------------------------------------------------------
// Replaces the provisional vaskpro.no rates. Changed in this revision:
//
//   Hyttevask    10 → 15 kr/m²   (renamed from "Standard vask")
//   Flyttevask   70 → 95 kr/m²   (renamed from "Grundig vask")
//   Byggvask     40 → 55 kr/m²
//   Sengetøy    190 → 200 kr, now per set rather than per person
//   Starter pack → Forbrukspakke, 300 → 375 kr per month
//   Removed: Vask av sengetøy, Flyttehjelp, Påfyll
//
// NOTE: Flyttevask no longer includes exterior window cleaning. The wizard
// rule that hid the window step hung on includesWindows being true here;
// it is false on every tier now, and `note` carries the replacement text.
export const PRICING = {
  cleaning: {
    hyttevask: {
      key: 'hyttevask',
      label: 'Hyttevask',
      description: 'Jevnlig vask av hytte eller bolig',
      rate: 15, // kr per m², inkl. MVA
      includesWindows: false,
    },
    flyttevask: {
      key: 'flyttevask',
      label: 'Flyttevask',
      description: 'Grundig utvask ved flytting',
      rate: 95, // kr per m², inkl. MVA
      includesWindows: false,
      note: 'Utvendig vindusvask etter avtale.',
      recommended: true,
    },
    byggvask: {
      key: 'byggvask',
      label: 'Byggvask',
      description: 'Etter oppussing eller bygging',
      rate: 55, // kr per m², inkl. MVA
      includesWindows: false,
    },
  },

  // TODO: the client points to "the old Sirdal Renhold site", but no window
  // price list is published there. The rates are readable from the window
  // calculator on vaskpro.no — confirm they carry over unchanged, then fill
  // in `price` and flip `available` to true.
  windows: {
    // Guard. While false the wizard collects the enquiry but quotes no
    // figure, and the price table shows "pris på forespørsel" rather than
    // a 0 kr line, which customers read as "included".
    available: false,
    tiers: [
      { id: '1-10', min: 1, max: 10, count: 10, label: '1–10 vinduer' },
      { id: '11-20', min: 11, max: 20, count: 20, label: '11–20 vinduer' },
      { id: '21-30', min: 21, max: 30, count: 30, label: '21–30 vinduer' },
      { id: '31-40', min: 31, max: 40, count: 40, label: '31–40 vinduer' },
      { id: '41-50', min: 41, max: 50, count: 50, label: '41–50 vinduer' },
    ],
    types: {
      enSide: { key: 'enSide', label: 'Én side', price: null }, // TODO: pris mangler
      komplett: { key: 'komplett', label: 'Komplett (begge sider)', price: null }, // TODO: pris mangler
    },
  },

  extras: {
    sengetoysett: {
      key: 'sengetoysett',
      label: 'Leie av sengetøy',
      unit: 'per sett',
      price: 200,
      description:
        'Inkluderer dynetrekk, putetrekk, laken, ett stort håndkle og ett lite håndkle.',
    },
    forbrukspakke: {
      key: 'forbrukspakke',
      label: 'Forbrukspakke',
      unit: 'per måned',
      price: 375,
      description:
        'Ingen abonnement eller automatisk fornyelse. Inneholder nødvendige ' +
        'forbruksvarer som toalettpapir, søppelposer, håndsåpe og oppvaskmiddel.',
    },
  },

  dodsbo: {
    // No fixed rate — always quoted after an on-site visit (befaring).
    label: 'Dødsbo',
    note: 'Pris fastsettes etter befaring',
  },
};

// ---------------------------------------------------------------------
// Out of scope for this delivery
// ---------------------------------------------------------------------
// Vedlevering, plenklipping, gressklipping på tak and snømåking are new
// services from the client's notes, billed separately as additional work.
// They are deliberately absent here so nothing half-built ships.
