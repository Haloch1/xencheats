/* ═══ XENCHEATS — Visual Effects (scroll reveal, glow, counters) ═══ */

/* Dynamic + defensive: a failure loading the widget must never take down
   the rest of this file (reveal, glow, nav scroll, ticker, etc). A static
   `import` here previously meant one throw in ai-widget.js's module graph
   silently aborted this entire script on every page. */
import("./ai-widget.js").catch(function (err) {
  console.error("[ai-widget] failed to load:", err);
});

(function () {
  'use strict';

  /* ── Scroll Reveal with blur ──
     NOTE: must add "is-visible" — that's the only class styles-v2.css
     actually defines a transition for (.reveal.is-visible). This used to
     add "visible" (no matching CSS rule), so on any page whose own script
     didn't separately call site.js's initReveal(), .reveal sections such as
     Terms, Privacy, Instructions, and 404 stayed at opacity:0 forever. */
  function initReveals() {
    // Pages that load site.js already have the canonical reveal observer. Do
    // not attach a second observer, which can schedule duplicate animations.
    if (window.__xenSiteRevealInitialized) return;
    var els = document.querySelectorAll('.reveal:not(.is-visible)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var delay = parseInt(e.target.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { e.target.classList.add('is-visible'); }, delay);
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: "0px 0px -22% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── Cursor-follow glow on cards ── */
  function initGlow() {
    var selectors = '.catalog-category-card, .review-card, .faq-item, .desk-panel, .hero-card, .member-panel, .auth-entry-card, .auth-card';
    document.querySelectorAll(selectors).forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
    });
  }

  /* ── Nav scroll effect ── */
  function initNavScroll() {
    var nav = document.querySelector('.topbar');
    if (!nav) return;
    var shell = nav.querySelector('.topbar-shell');
    if (!shell) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 12) {
        shell.style.background = 'rgba(23,16,15,0.92)';
        shell.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
      } else {
        shell.style.background = 'rgba(23,16,15,0.72)';
        shell.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
      }
    }, { passive: true });
  }

  /* ── Ticker pause on hover ──
     Real-mouse only. On touch devices a tap can fire a synthetic
     "mouseenter" with no matching "mouseleave" ever following, which froze
     the marquee mid-scroll permanently — whatever phrase happened to be in
     view at that instant, with blank space where the rest hadn't scrolled
     in yet. */
  function initTicker() {
    var track = document.querySelector('.ticker-track');
    if (!track) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var ticker = track.parentElement;
    ticker.addEventListener('mouseenter', function () { track.style.animationPlayState = 'paused'; });
    ticker.addEventListener('mouseleave', function () { track.style.animationPlayState = 'running'; });
  }

  /* ── Cheat UI tab switching ── */
  function initCheatUI() {
    var tabs = document.querySelectorAll('.cheat-ui-tabs span');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
      });
    });
    // Toggle switches
    document.querySelectorAll('.cheat-setting i').forEach(function (sw) {
      sw.addEventListener('click', function () {
        sw.classList.toggle('is-on');
      });
    });
  }

  /* ── Footer year ── */
  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ── Init ── */
  function initEffects() {
    initReveals();
    initNavScroll();
    initTicker();
    initCheatUI();
    initYear();
    // Delay glow init slightly so cards are rendered
    setTimeout(initGlow, 500);
  }

  // effects.js is loaded both directly and through page modules. If a module
  // imports it after DOMContentLoaded, an event-only initializer never runs
  // and every reveal remains hidden. Boot immediately in that case.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEffects, { once: true });
  } else {
    initEffects();
  }
})();
