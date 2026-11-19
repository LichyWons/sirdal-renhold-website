// Two calculators live here:
//  1. initMiniCalculator() - the two-slider teaser on index.html.
//  2. initPriceWizard()    - the full multi-screen wizard on priser.html.
//
// The wizard keeps its state in a plain object and mirrors the current
// screen to location.hash (e.g. "#steg=2"), so the browser Back button
// steps backward through the wizard instead of leaving the page.
//
// Submitting the wizard posts to Netlify Forms (see FORM_NAME below). That
// stores the lead, notifies the client, and triggers the auto-reply in
// netlify/functions/submission-created.mjs.

import { PRICING } from './config.js';

const DISCLAIMER =
  'Anslaget er veiledende og ikke et bindende tilbud. Endelig pris bekreftes etter befaring.';

// Must match the hidden static form in priser.html. Netlify parses the
// built HTML to register forms, and never sees a form that JavaScript
// creates — the hidden copy is what makes this name exist.
const FORM_NAME = 'prisforesporsel';

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
    const type = checked ? checked.value : 'hyttevask';
    const service = PRICING.cleaning[type];
    if (!service) return;
    if (areaValue) areaValue.textContent = String(area);
    if (resultEl) resultEl.textContent = formatNOK(area * service.rate);
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
    needs: { rengjoring: false, vindusvask: false, dodsbo: false },
    cleaning: { type: null, area: 80 },
    windows: { tierId: null, type: null },
    extras: { sengetoysett: 0, forbrukspakke: false },
  };
}

/** Decide which screens apply, in order, based on the answers on screen 1. */
function computeFlow(needs) {
  const onlyDodsbo = needs.dodsbo && !needs.rengjoring && !needs.vindusvask;
  if (onlyDodsbo) return ['needs', 'summary'];

  const flow = ['needs'];
  if (needs.rengjoring) flow.push('cleaning');
  if (needs.vindusvask) flow.push('windows');
  // Add-ons only make sense alongside cleaning, not for a pure window job.
  if (needs.rengjoring) flow.push('extras');
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

    // Flyttevask no longer bundles exterior windows; say so where the
    // customer is reading the price rather than burying it in the FAQ.
    if (service.note) {
      lines.push({ label: service.label, amount: null, note: service.note });
    }
  }

  if (state.needs.vindusvask && state.windows.tierId && state.windows.type) {
    const tier = PRICING.windows.tiers.find((t) => t.id === state.windows.tierId);
    const type = PRICING.windows.types[state.windows.type];
    const price = PRICING.windows.available ? type?.price : null;

    if (price != null && tier) {
      const amount = tier.count * price;
      lines.push({ label: `Vindusvask – ${tier.label}, ${type.label}`, amount });
      total += amount;
    } else {
      // No rates configured yet — never invent a price, and never show 0 kr,
      // which customers read as "included".
      lines.push({
        label: `Vindusvask – ${tier ? tier.label : ''}${type ? `, ${type.label}` : ''}`,
        amount: null,
        note: 'Pris på forespørsel',
      });
    }
  }

  if (state.extras.sengetoysett > 0) {
    const extra = PRICING.extras.sengetoysett;
    const amount = state.extras.sengetoysett * extra.price;
    lines.push({ label: `${extra.label} × ${state.extras.sengetoysett}`, amount });
    total += amount;
  }

  if (state.extras.forbrukspakke) {
    const extra = PRICING.extras.forbrukspakke;
    lines.push({ label: `${extra.label} (${extra.unit})`, amount: extra.price });
    total += extra.price;
  }

  if (state.needs.dodsbo) {
    // Never part of the sum — always quoted after a site visit.
    lines.push({ label: PRICING.dodsbo.label, amount: null, note: PRICING.dodsbo.note });
  }

  return { lines, total };
}

/** Flatten the wizard state into the fields the Netlify form expects. */
function summariseForForm(state) {
  const { lines, total } = computeLines(state);

  const service = state.cleaning.type ? PRICING.cleaning[state.cleaning.type] : null;
  const chosen = [];
  if (state.needs.rengjoring && service) chosen.push(service.label);
  if (state.needs.vindusvask) chosen.push('Vindusvask');
  if (state.needs.dodsbo) chosen.push('Dødsbo');

  const windowTier = PRICING.windows.tiers.find((t) => t.id === state.windows.tierId);
  const windowType = PRICING.windows.types[state.windows.type];

  const tillegg = [];
  if (state.extras.sengetoysett > 0) {
    tillegg.push(`${PRICING.extras.sengetoysett.label} × ${state.extras.sengetoysett}`);
  }
  if (state.extras.forbrukspakke) tillegg.push(PRICING.extras.forbrukspakke.label);

  return {
    tjeneste: chosen.join(', '),
    areal: state.needs.rengjoring ? String(state.cleaning.area) : '',
    vindusvask: windowTier
      ? `${windowTier.label}${windowType ? `, ${windowType.label}` : ''}`
      : '',
    tillegg: tillegg.join(', '),
    anslag: lines.some((l) => l.amount != null) ? formatNOK(total) : 'Etter befaring',
  };
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
  const tiers = PRICING.windows.tiers;
  const types = Object.values(PRICING.windows.types);
  const selected = state.cleaning.type ? PRICING.cleaning[state.cleaning.type] : null;

  container.innerHTML = `
    <h2>Vindusvask</h2>
    ${
      selected && selected.note
        ? `<p class="wizard-note">${selected.note}</p>`
        : '<p class="wizard-note">Vindusvask kommer i tillegg til rengjøringen.</p>'
    }
    <div class="wizard-field">
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
      ${
        PRICING.windows.available
          ? ''
          : '<p class="wizard-note">Pris for vindusvask oppgis av oss direkte etter forespørselen.</p>'
      }
    </div>
    <p class="wizard-hint" data-hint></p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
      <button type="button" class="btn btn-primary" data-next>Neste</button>
    </div>
  `;

  const tierSelect = container.querySelector('#window-tier');
  const typeRadios = container.querySelectorAll('input[name="window-type"]');
  const nextBtn = container.querySelector('[data-next]');
  const hint = container.querySelector('[data-hint]');

  function updateEnabled() {
    const filled = Boolean(state.windows.tierId && state.windows.type);
    nextBtn.disabled = !filled;
    hint.hidden = filled;
    hint.textContent = 'Velg antall vinduer og type for å fortsette.';
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
  const sengetoy = PRICING.extras.sengetoysett;
  const forbruk = PRICING.extras.forbrukspakke;

  container.innerHTML = `
    <h2>Tillegg</h2>
    <p>Valgfritt — hopp over hvis du ikke trenger noe av dette.</p>
    <div class="wizard-field">
      <label for="sengetoysett">${sengetoy.label} – ${formatNOK(sengetoy.price)} ${sengetoy.unit}</label>
      <input type="number" id="sengetoysett" min="0" step="1" value="${state.extras.sengetoysett}">
      <p class="wizard-note">${sengetoy.description}</p>
    </div>
    <label class="checkbox-field">
      <input type="checkbox" id="forbrukspakke" ${state.extras.forbrukspakke ? 'checked' : ''}>
      ${forbruk.label} – ${formatNOK(forbruk.price)} ${forbruk.unit}
    </label>
    <p class="wizard-note">${forbruk.description}</p>
    <div class="wizard-nav">
      <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
      <button type="button" class="btn btn-tertiary" data-skip>Hopp over</button>
      <button type="button" class="btn btn-primary" data-next>Neste</button>
    </div>
  `;

  container.querySelector('#sengetoysett').addEventListener('input', (e) => {
    state.extras.sengetoysett = Math.max(0, Number(e.target.value) || 0);
  });
  container.querySelector('#forbrukspakke').addEventListener('change', (e) => {
    state.extras.forbrukspakke = e.target.checked;
  });

  container.querySelector('[data-prev]').addEventListener('click', prev);
  container.querySelector('[data-skip]').addEventListener('click', next);
  container.querySelector('[data-next]').addEventListener('click', next);
}

function renderSummaryScreen(container, state, { prev }) {
  const onlyDodsbo = state.needs.dodsbo && !state.needs.rengjoring && !state.needs.vindusvask;
  const { lines, total } = computeLines(state);
  const priced = lines.some((line) => line.amount != null);

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
      ${priced ? `<p class="summary-total"><span>Sum</span><strong>${formatNOK(total)}</strong></p>` : ''}
    `
    }
    <p class="disclaimer">${DISCLAIMER}</p>
    <form name="${FORM_NAME}" method="POST" data-netlify="true"
          netlify-honeypot="bot-field" data-quote-form>
      <input type="hidden" name="form-name" value="${FORM_NAME}">
      <p hidden><label>La stå tom <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <input type="hidden" name="tjeneste" data-field="tjeneste">
      <input type="hidden" name="areal" data-field="areal">
      <input type="hidden" name="vindusvask" data-field="vindusvask">
      <input type="hidden" name="tillegg" data-field="tillegg">
      <input type="hidden" name="anslag" data-field="anslag">
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
      <p class="wizard-hint" data-form-error hidden></p>
      <div class="wizard-nav">
        <button type="button" class="btn btn-secondary" data-prev>Tilbake</button>
        <button type="submit" class="btn btn-primary">Send forespørsel</button>
      </div>
    </form>
  `;

  container.querySelector('[data-prev]').addEventListener('click', prev);

  const form = container.querySelector('[data-quote-form]');
  const errorEl = container.querySelector('[data-form-error]');

  // Carry the quote itself into the submission, so the lead in Netlify and
  // the confirmation e-mail both show what the customer actually chose.
  const summary = summariseForForm(state);
  Object.entries(summary).forEach(([key, value]) => {
    const field = form.querySelector(`[data-field="${key}"]`);
    if (field) field.value = value;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // The wizard form is built by JavaScript, so the browser's own
    // validation UI is all we have here — reportValidity triggers it.
    if (!form.reportValidity()) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    errorEl.hidden = true;

    try {
      // Netlify accepts form posts at any path on the site as long as
      // form-name matches a form it registered at build time — that is the
      // hidden static copy in priser.html.
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });

      if (!response.ok) throw new Error(`Netlify Forms returned ${response.status}`);
      window.location.href = '/takk.html';
    } catch (err) {
      console.error('[wizard] submission failed', err);
      submitBtn.disabled = false;
      errorEl.hidden = false;
      errorEl.textContent =
        'Vi fikk ikke sendt forespørselen. Prøv igjen, eller ring oss på 462 15 212.';
    }
  });
}
