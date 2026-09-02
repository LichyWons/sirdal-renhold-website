// Two calculators live here:
//  1. initMiniCalculator() - the two-slider teaser on index.html.
//  2. initPriceWizard()    - the full four-screen wizard on priser.html.
//
// The wizard keeps its state in a plain object and mirrors the current
// screen to location.hash (e.g. "#steg=2"), so the browser Back button
// steps backward through the wizard instead of leaving the page.

import { PRICING } from './config.js';

const DISCLAIMER =
  'Anslaget er veiledende og ikke et bindende tilbud. Endelig pris bekreftes etter befaring.';

/** Format a number the Norwegian way, e.g. 1234 -> "1 234 kr". */
function formatNOK(amount) {
  return `${new Intl.NumberFormat('nb-NO').format(Math.round(amount))} kr`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------------------------------------------ */
/* 1. Homepage mini calculator (two sliders)                          */
/* ------------------------------------------------------------------ */

export function initMiniCalculator() {
  const widget = document.querySelector('[data-mini-calc]');
  if (!widget) return;

  const areaInput = widget.querySelector('[data-mini-calc-area]');
  const areaValue = widget.querySelector('[data-mini-calc-area-value]');
  const typeInputs = widget.querySelectorAll('[data-mini-calc-type]');
  const resultEl = widget.querySelector('[data-mini-calc-result]');

  function update() {
    const area = Number(areaInput.value);
    const checked = widget.querySelector('[data-mini-calc-type]:checked');
    const type = checked ? checked.value : 'standard';
    const rate = PRICING.cleaning[type].rate;
    if (areaValue) areaValue.textContent = String(area);
    if (resultEl) resultEl.textContent = formatNOK(area * rate);
  }

  areaInput.addEventListener('input', update);
  typeInputs.forEach((input) => input.addEventListener('change', update));
  update();
}

/* ------------------------------------------------------------------ */
/* 2. Full price wizard (priser.html)                                 */
/* ------------------------------------------------------------------ */

function createInitialState() {
  return {
    needs: { rengjoring: false, vindusvask: false, flyttehjelp: false, dodsbo: false },
    cleaning: { type: null, area: 80 },
    windows: { addExtra: false, tierId: null, type: null },
    extras: { sengetoysett: 0, vaskAvSengetoy: 0, starterPack: false, flyttehjelpHours: 0 },
  };
}

/** Decide which screens apply, in order, based on the answers on screen 1. */
function computeFlow(needs) {
  const onlyDodsbo = needs.dodsbo && !needs.rengjoring && !needs.vindusvask && !needs.flyttehjelp;
  if (onlyDodsbo) return ['needs', 'summary'];

  const flow = ['needs'];
  if (needs.rengjoring) flow.push('cleaning');
  if (needs.vindusvask) flow.push('windows');
  flow.push('extras'); // Always offered, always skippable.
  flow.push('summary');
  return flow;
}

/** Build the priced line items + running total for the summary screen. */
function computeLines(state) {
  const lines = [];
  let total = 0;

  if (state.needs.rengjoring && state.cleaning.type) {
    const service = PRICING.cleaning[state.cleaning.type];
    const amount = service.rate * state.cleaning.area;
    lines.push({ label: `${service.label} – ${state.cleaning.area} m²`, amount });
    total += amount;
  }

  if (state.needs.vindusvask) {
    const includedByGrundig = state.cleaning.type === 'grundig';
    if (includedByGrundig) {
      lines.push({
        label: 'Vindusvask (inne og ute)',
        amount: 0,
        note: 'Inkludert i Grundig vask',
      });
    }
    const wantsPricedExtra = !includedByGrundig || state.windows.addExtra;
    if (wantsPricedExtra && state.windows.tierId && state.windows.type) {
      // No rates exist yet for window cleaning - never invent a price here.
      lines.push({
        label: includedByGrundig ? 'Vindusvask – utover inkludert omfang' : 'Vindusvask',
        amount: 0,
        note: 'Pris oppgis av oss (satser mangler)',
      });
    }
  }

  if (state.extras.sengetoysett > 0) {
    const amount = state.extras.sengetoysett * PRICING.extras.sengetoysett.price;
    lines.push({ label: `Sengetøysett (leie) × ${state.extras.sengetoysett}`, amount });
    total += amount;
  }

  if (state.extras.vaskAvSengetoy > 0) {
    const amount = state.extras.vaskAvSengetoy * PRICING.extras.vaskAvSengetoy.price;
    lines.push({ label: `Vask av sengetøy × ${state.extras.vaskAvSengetoy}`, amount });
    total += amount;
  }

  if (state.extras.starterPack) {
    const amount = PRICING.extras.starterPack.price;
    lines.push({ label: 'Starter pack', amount });
    total += amount;
  }

  if (state.needs.flyttehjelp && state.extras.flyttehjelpHours > 0) {
    const discountApplies = state.needs.rengjoring && state.cleaning.type === 'grundig';
    let amount = PRICING.flyttehjelp.hourlyRate * state.extras.flyttehjelpHours;
    if (discountApplies) amount *= 1 - PRICING.flyttehjelp.discountWithGrundig;
    lines.push({
      label: `Flyttehjelp × ${state.extras.flyttehjelpHours} t${discountApplies ? ' (10 % rabatt)' : ''}`,
      amount,
    });
    total += amount;
  }

  if (state.needs.dodsbo) {
    // Never part of the sum - always quoted after a site visit.
    lines.push({ label: 'Dødsbo', amount: null, note: PRICING.dodsbo.note });
  }

  return { lines, total };
}

export function initPriceWizard() {
  const root = document.querySelector('[data-wizard]');
  if (!root) return;

  const state = createInitialState();
  let flow = ['needs'];
  let index = 0;
  let furthest = 0;

  function goTo(newIndex) {
    index = clamp(newIndex, 0, flow.length - 1);
    furthest = Math.max(furthest, index);
    window.location.hash = `steg=${index + 1}`;
    render();
  }

  function next() {
    flow = computeFlow(state.needs);
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  function onHashChange() {
    const match = window.location.hash.match(/steg=(\d+)/);
    if (!match) return;
    const requested = Number(match[1]) - 1;
    // Only allow jumping to a screen the user has already reached, so the
    // Back button steps backward instead of skipping validation forward.
    if (requested >= 0 && requested <= furthest && requested !== index) {
      index = requested;
      render();
    }
  }

  window.addEventListener('hashchange', onHashChange);

  const renderers = {
    needs: renderNeedsScreen,
    cleaning: renderCleaningScreen,
    windows: renderWindowsScreen,
    extras: renderExtrasScreen,
    summary: renderSummaryScreen,
  };

  function render() {
    root.innerHTML = '';
    const screenId = flow[index];
    const percent = Math.round(((index + 1) / flow.length) * 100);

    const progress = document.createElement('p');
    progress.className = 'wizard-progress';
    progress.setAttribute('aria-live', 'polite');
    progress.innerHTML = `<span>Steg ${index + 1} av ${flow.length}</span>`;
    root.appendChild(progress);

    const progressBar = document.createElement('div');
    progressBar.className = 'wizard-progress-bar';
    progressBar.innerHTML = `<span style="width: ${percent}%"></span>`;
    root.appendChild(progressBar);

    if (index > 0 && screenId !== 'summary') {
      const { total } = computeLines(state);
      const sumBar = document.createElement('p');
      sumBar.className = 'wizard-sum';
      sumBar.innerHTML = `<span>Foreløpig sum</span><strong>${formatNOK(total)}</strong>`;
      root.appendChild(sumBar);
    }

    const screenEl = document.createElement('div');
    screenEl.className = 'wizard-screen';
    root.appendChild(screenEl);

    renderers[screenId](screenEl, state, { next, prev });
  }

  // A stale "#steg=N" from a previous visit is meaningless until screen 1
  // has been answered again, so start clean on every fresh load.
  if (window.location.hash) window.location.hash = '';
  goTo(0);
}

function renderNeedsScreen(container, state, { next }) {
  const options = [
    ['rengjoring', 'Rengjøring'],
    ['vindusvask', 'Vindusvask'],
    ['flyttehjelp', 'Flyttehjelp'],
    ['dodsbo', 'Dødsbo'],
  ];

  container.innerHTML = `
    <h2>Hva trenger du hjelp med?</h2>
    <p>Velg ett eller flere alternativer.</p>
    <div class="wizard-options" role="group" aria-label="Hva trenger du hjelp med?">
      ${options
        .map(
          ([key, label]) => `
        <label class="option-card">
          <input type="checkbox" name="needs" value="${key}" ${state.needs[key] ? 'checked' : ''}>
          <span>${label}</span>
        </label>
      `
        )
        .join('')}
    </div>
    <p class="wizard-hint" data-hint>Velg minst ett alternativ for å fortsette.</p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-primary" data-next disabled>Neste</button>
    </div>
  `;

  const checkboxes = container.querySelectorAll('input[name="needs"]');
  const nextBtn = container.querySelector('[data-next]');
  const hint = container.querySelector('[data-hint]');

  function updateEnabled() {
    const anyChecked = Array.from(checkboxes).some((cb) => cb.checked);
    nextBtn.disabled = !anyChecked;
    hint.hidden = anyChecked;
  }

  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      state.needs[cb.value] = cb.checked;
      updateEnabled();
    });
  });

  updateEnabled();
  nextBtn.addEventListener('click', next);
}

function renderCleaningScreen(container, state, { next, prev }) {
  const variants = Object.values(PRICING.cleaning);

  container.innerHTML = `
    <h2>Rengjøring</h2>
    <div class="wizard-field">
      <label for="area-slider">Areal: <output id="area-output">${state.cleaning.area}</output> m²</label>
      <input type="range" id="area-slider" min="20" max="300" step="1" value="${state.cleaning.area}">
    </div>
    <div class="variant-cards" role="radiogroup" aria-label="Type vask">
      ${variants.map(variantCard).join('')}
    </div>
    <p class="wizard-hint" data-hint ${state.cleaning.type ? 'hidden' : ''}>Velg en type vask for å fortsette.</p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
      <button type="button" class="btn btn-primary" data-next ${state.cleaning.type ? '' : 'disabled'}>Neste</button>
    </div>
  `;

  function variantCard(v) {
    const price = formatNOK(v.rate * state.cleaning.area);
    const selected = state.cleaning.type === v.key;
    return `
      <label class="variant-card ${v.recommended ? 'is-recommended' : ''} ${selected ? 'is-selected' : ''}">
        ${v.recommended ? '<span class="badge">Anbefalt</span>' : ''}
        <input type="radio" name="cleaning-type" value="${v.key}" ${selected ? 'checked' : ''}>
        <span class="variant-name">${v.label}</span>
        <span class="variant-desc">${v.description}</span>
        <span class="variant-price" data-variant-price="${v.key}">${price}</span>
      </label>
    `;
  }

  const areaSlider = container.querySelector('#area-slider');
  const areaOutput = container.querySelector('#area-output');
  const radios = container.querySelectorAll('input[name="cleaning-type"]');
  const nextBtn = container.querySelector('[data-next]');
  const hint = container.querySelector('[data-hint]');

  function updatePrices() {
    variants.forEach((v) => {
      const el = container.querySelector(`[data-variant-price="${v.key}"]`);
      if (el) el.textContent = formatNOK(v.rate * state.cleaning.area);
    });
  }

  areaSlider.addEventListener('input', () => {
    state.cleaning.area = Number(areaSlider.value);
    areaOutput.textContent = String(state.cleaning.area);
    updatePrices();
  });

  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      state.cleaning.type = radio.value;
      nextBtn.disabled = false;
      hint.hidden = true;
      container.querySelectorAll('.variant-card').forEach((card) => card.classList.remove('is-selected'));
      radio.closest('.variant-card').classList.add('is-selected');
    });
  });

  container.querySelector('[data-prev]').addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
}

function renderWindowsScreen(container, state, { next, prev }) {
  const includedByGrundig = state.cleaning.type === 'grundig';
  const tiers = PRICING.windows.tiers;
  const types = Object.values(PRICING.windows.types);

  container.innerHTML = `
    <h2>Vindusvask</h2>
    ${
      includedByGrundig
        ? `
      <p class="wizard-note">Vinduspuss innvendig og utvendig er allerede inkludert i Grundig vask.</p>
      <label class="checkbox-field">
        <input type="checkbox" id="extra-windows" ${state.windows.addExtra ? 'checked' : ''}>
        Jeg trenger vindusvask utover det som er inkludert
      </label>
    `
        : `
      <p class="wizard-note">Vindusvask kommer i tillegg til rengjøringen.</p>
    `
    }
    <div class="wizard-field" data-windows-detail>
      <label for="window-tier">Antall vinduer</label>
      <select id="window-tier">
        <option value="">Velg antall</option>
        ${tiers
          .map((t) => `<option value="${t.id}" ${state.windows.tierId === t.id ? 'selected' : ''}>${t.label}</option>`)
          .join('')}
      </select>
      <fieldset class="wizard-fieldset">
        <legend>Type vask</legend>
        ${types
          .map(
            (t) => `
          <label class="chip">
            <input type="radio" name="window-type" value="${t.key}" ${state.windows.type === t.key ? 'checked' : ''}>
            ${t.label}
          </label>
        `
          )
          .join('')}
      </fieldset>
      <p class="wizard-note">Pris for vindusvask er ikke fastsatt ennå og oppgis av oss direkte.</p>
    </div>
    <p class="wizard-hint" data-hint></p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
      <button type="button" class="btn btn-primary" data-next>Neste</button>
    </div>
  `;

  const detail = container.querySelector('[data-windows-detail]');
  const extraCheckbox = container.querySelector('#extra-windows');
  const tierSelect = container.querySelector('#window-tier');
  const typeRadios = container.querySelectorAll('input[name="window-type"]');
  const nextBtn = container.querySelector('[data-next]');
  const hint = container.querySelector('[data-hint]');

  function detailRequired() {
    return !includedByGrundig || (extraCheckbox && extraCheckbox.checked);
  }

  function updateEnabled() {
    const required = detailRequired();
    detail.hidden = !required;
    const filled = !required || (state.windows.tierId && state.windows.type);
    nextBtn.disabled = !filled;
    hint.hidden = filled;
    hint.textContent = 'Velg antall vinduer og type for å fortsette.';
  }

  if (extraCheckbox) {
    extraCheckbox.addEventListener('change', () => {
      state.windows.addExtra = extraCheckbox.checked;
      updateEnabled();
    });
  }

  tierSelect.addEventListener('change', () => {
    state.windows.tierId = tierSelect.value || null;
    updateEnabled();
  });

  typeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      state.windows.type = radio.value;
      updateEnabled();
    });
  });

  updateEnabled();
  container.querySelector('[data-prev]').addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
}

function renderExtrasScreen(container, state, { next, prev }) {
  container.innerHTML = `
    <h2>Tillegg</h2>
    <p>Valgfritt — hopp over hvis du ikke trenger noe av dette.</p>
    <div class="wizard-field">
      <label for="sengetoysett">Sengetøysett (leie) – ${formatNOK(PRICING.extras.sengetoysett.price)} per person</label>
      <input type="number" id="sengetoysett" min="0" step="1" value="${state.extras.sengetoysett}">
    </div>
    <div class="wizard-field">
      <label for="vask-av-sengetoy">Vask av sengetøy – ${formatNOK(PRICING.extras.vaskAvSengetoy.price)} per stk</label>
      <input type="number" id="vask-av-sengetoy" min="0" step="1" value="${state.extras.vaskAvSengetoy}">
    </div>
    <label class="checkbox-field">
      <input type="checkbox" id="starter-pack" ${state.extras.starterPack ? 'checked' : ''}>
      Starter pack – ${formatNOK(PRICING.extras.starterPack.price)}
    </label>
    ${
      state.needs.flyttehjelp
        ? `
      <div class="wizard-field">
        <label for="flyttehjelp-hours">Flyttehjelp – ${formatNOK(PRICING.flyttehjelp.hourlyRate)}/t</label>
        <input type="number" id="flyttehjelp-hours" min="0" step="1" value="${state.extras.flyttehjelpHours}">
        ${
          state.needs.rengjoring && state.cleaning.type === 'grundig'
            ? '<p class="wizard-note">10 % rabatt gjelder siden Grundig vask er valgt samtidig.</p>'
            : ''
        }
      </div>
    `
        : ''
    }
    <div class="wizard-nav">
      <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
      <button type="button" class="btn btn-tertiary" data-skip>Hopp over</button>
      <button type="button" class="btn btn-primary" data-next>Neste</button>
    </div>
  `;

  container.querySelector('#sengetoysett').addEventListener('input', (e) => {
    state.extras.sengetoysett = Math.max(0, Number(e.target.value) || 0);
  });
  container.querySelector('#vask-av-sengetoy').addEventListener('input', (e) => {
    state.extras.vaskAvSengetoy = Math.max(0, Number(e.target.value) || 0);
  });
  container.querySelector('#starter-pack').addEventListener('change', (e) => {
    state.extras.starterPack = e.target.checked;
  });
  const hoursInput = container.querySelector('#flyttehjelp-hours');
  if (hoursInput) {
    hoursInput.addEventListener('input', (e) => {
      state.extras.flyttehjelpHours = Math.max(0, Number(e.target.value) || 0);
    });
  }

  container.querySelector('[data-prev]').addEventListener('click', prev);
  container.querySelector('[data-skip]').addEventListener('click', next);
  container.querySelector('[data-next]').addEventListener('click', next);
}

function renderSummaryScreen(container, state, { prev }) {
  const onlyDodsbo =
    state.needs.dodsbo && !state.needs.rengjoring && !state.needs.vindusvask && !state.needs.flyttehjelp;
  const { lines, total } = computeLines(state);

  container.innerHTML = `
    <h2>Oppsummering og kontaktinfo</h2>
    ${
      onlyDodsbo
        ? `<p class="wizard-note">Dødsbo prises alltid etter befaring. Fyll ut skjemaet under, så tar vi kontakt for å avtale et besøk.</p>`
        : `
      <ul class="summary-lines">
        ${lines
          .map(
            (line) => `
          <li>
            <span>${line.label}</span>
            <span>${line.note ? line.note : formatNOK(line.amount)}</span>
          </li>
        `
          )
          .join('')}
      </ul>
      <p class="summary-total"><span>Sum</span><strong>${formatNOK(total)}</strong></p>
    `
    }
    <p class="disclaimer">${DISCLAIMER}</p>
    <form data-contact-form novalidate>
      <div class="form-field">
        <label for="contact-name">Navn</label>
        <input type="text" id="contact-name" name="name" required autocomplete="name">
      </div>
      <div class="form-field">
        <label for="contact-phone">Telefon</label>
        <input type="tel" id="contact-phone" name="phone" required autocomplete="tel">
      </div>
      <div class="form-field">
        <label for="contact-email">E-post</label>
        <input type="email" id="contact-email" name="email" required autocomplete="email">
      </div>
      <div class="form-field">
        <label for="contact-message">Beskjed (valgfritt)</label>
        <textarea id="contact-message" name="message" rows="4"></textarea>
      </div>
      <label class="checkbox-field">
        <input type="checkbox" id="contact-consent" name="consent" required>
        Jeg samtykker til at Sirdal Renhold AS lagrer opplysningene mine for å ta kontakt, se
        <a href="/personvern.html">personvernerklæringen</a>.
      </label>
      <div class="wizard-nav">
        <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
        <button type="submit" class="btn btn-primary">Send</button>
      </div>
    </form>
  `;

  container.querySelector('[data-prev]').addEventListener('click', prev);

  const form = container.querySelector('[data-contact-form]');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // TODO: faza 3 - send skjemadata til backend (f.eks. en Netlify
    // Function) og utløs en bekreftelses-e-post. Inntil videre bare
    // omdirigerer vi til takkesiden.
    window.location.href = '/takk.html';
  });
}
