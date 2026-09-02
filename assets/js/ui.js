// Shared site-wide behaviour: navigation, business info hydration,
// scroll-triggered animations and the sticky mobile CTA bar.
// Loaded as a module on every page.

import { BUSINESS } from './config.js';

/**
 * Fill in header/footer placeholders with data from config.js, so contact
 * details only ever need to change in one place. The HTML already contains
 * the current real values as a no-JS fallback; this keeps them honest.
 */
function hydrateBusinessInfo() {
  document.querySelectorAll('[data-business]').forEach((el) => {
    const key = el.dataset.business;
    switch (key) {
      case 'phone-href':
        el.setAttribute('href', `tel:${BUSINESS.phone}`);
        break;
      case 'phone-display':
        el.textContent = BUSINESS.phoneDisplay;
        break;
      case 'email-href':
        el.setAttribute('href', `mailto:${BUSINESS.email}`);
        break;
      case 'email-display':
        el.textContent = BUSINESS.email;
        break;
      case 'org-nr':
        el.textContent = `Org.nr: ${BUSINESS.orgNr}`;
        break;
      case 'name':
        el.textContent = BUSINESS.name;
        break;
      default:
        break;
    }
  });

  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

/**
 * Deepens the header's shadow once the page has scrolled, so the sticky
 * bar reads as a layer above the content instead of blending into it.
 * See the .site-header.is-scrolled rule in components.css.
 */
function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateState = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  updateState();
  window.addEventListener('scroll', updateState, { passive: true });
}

/** Mobile hamburger menu toggle. */
function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
  });

  // Close the menu whenever a nav link is followed.
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    });
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
 * who prefer reduced motion. Elements reserve their layout space via CSS
 * so this never contributes to layout shift.
 */
function initScrollAnimations() {
  const targets = document.querySelectorAll('[data-animate]');
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    { threshold: 0.15 }
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
