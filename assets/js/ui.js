// Shared site-wide behaviour: navigation, business info hydration,
// scroll-triggered animations and the sticky mobile CTA bar.
// Loaded as a module on every page.

import { BUSINESS } from './config.js';

// Marks that JavaScript is running. CSS hides [data-animate] elements only
// under .js, so a failed script leaves the content visible instead of a
// page of invisible sections. Set at module scope, before first paint.
document.documentElement.classList.add('js');

/**
 * Fill in header/footer placeholders with data from config.js, so contact
 * details only ever need to change in one place. The HTML already contains
 * the current real values as a no-JS fallback; this keeps them honest.
 */
function hydrateBusinessInfo() {
  document.querySelectorAll('[data-business]').forEach((el) => {
    switch (el.dataset.business) {
      case 'phone-href':
        el.setAttribute('href', `tel:${BUSINESS.phone}`);
        break;

      case 'phone-display':
        el.textContent = BUSINESS.phoneDisplay;
        break;

      // Email is null until the client supplies one. Building the link
      // anyway would ship a working mailto:null, so the block is removed.
      case 'email-href':
        if (!BUSINESS.email) return hideOptional(el);
        el.setAttribute('href', `mailto:${BUSINESS.email}`);
        break;

      case 'email-display':
        if (!BUSINESS.email) return hideOptional(el);
        el.textContent = BUSINESS.email;
        break;

      // The "Org.nr:" label lives in the HTML, around this span — writing
      // it here too would render it twice, and it reads wrong mid-sentence
      // on personvern.html.
      case 'org-nr':
        el.textContent = BUSINESS.orgNr;
        break;

      case 'name':
        el.textContent = BUSINESS.name;
        break;

      default:
        break;
    }
  });

  // querySelectorAll returns a NodeList — it has no textContent, and it is
  // truthy even when empty. Iterate.
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

/** Removes the smallest sensible wrapper, so no stray bullet is left. */
function hideOptional(el) {
  const target =
    el.closest('[data-business-optional]') ?? el.closest('li') ?? el;
  target.remove();
}

/**
 * Deepens the header's shadow once the page has scrolled, so the sticky
 * bar reads as a layer above the content instead of blending into it.
 * See the .site-header.is-scrolled rule in components.css.
 */
function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateState = () =>
    header.classList.toggle('is-scrolled', window.scrollY > 4);

  updateState();
  window.addEventListener('scroll', updateState, { passive: true });
}

/** Mobile hamburger menu toggle. */
function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!toggle || !nav) return;

  const label = toggle.querySelector('.sr-only');

  const setOpen = (isOpen) => {
    nav.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
    if (label) label.textContent = isOpen ? 'Lukk meny' : 'Åpne meny';
  };

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'));
  });

  // Close whenever a nav link is followed.
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  // Escape closes the menu and returns focus to the button — otherwise
  // keyboard users are stranded inside an open menu.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/**
 * Sticky CTA bar that appears once the hero has scrolled out of view.
 * On pages without a hero section there is nothing to scroll past, so the
 * bar is simply shown right away.
 */
function initStickyCta() {
  const bar = document.querySelector('[data-sticky-cta]');
  if (!bar) return;

  const hero = document.querySelector('[data-hero]');
  if (!hero || !('IntersectionObserver' in window)) {
    bar.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(([entry]) => {
    bar.classList.toggle('is-visible', !entry.isIntersecting);
  });

  observer.observe(hero);
}

/**
 * Fade/slide-in animation for elements marked [data-animate].
 * Only animates transform + opacity (~400ms), skipped entirely for users
 * who prefer reduced motion. Transform-only motion means this never
 * affects layout, so it cannot contribute to layout shift.
 */
function initScrollAnimations() {
  const targets = document.querySelectorAll('[data-animate]');
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  targets.forEach((el) => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateBusinessInfo();
  initHeaderScrollState();
  initNav();
  initStickyCta();
  initScrollAnimations();
});
