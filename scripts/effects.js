/* ═══ XENCHEATS — Visual Effects (scroll reveal, glow, counters) ═══ */
(function () {
  'use strict';

  /* ── Scroll Reveal with blur ── */
  function initReveals() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var delay = parseInt(e.target.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { e.target.classList.add('visible'); }, delay);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
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
    window.addEventListener('scroll', function () {
      if (window.scrollY > 12) {
        shell.style.background = 'rgba(255,255,255,0.95)';
        shell.style.boxShadow = '0 12px 40px rgba(28,25,23,0.10)';
      } else {
        shell.style.background = 'rgba(255,255,255,0.82)';
        shell.style.boxShadow = '0 8px 32px rgba(28,25,23,0.06)';
      }
    }, { passive: true });
  }

  /* ── Ticker pause on hover ── */
  function initTicker() {
    var track = document.querySelector('.ticker-track');
    if (!track) return;
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
  document.addEventListener('DOMContentLoaded', function () {
    initReveals();
    initNavScroll();
    initTicker();
    initCheatUI();
    initYear();
    // Delay glow init slightly so cards are rendered
    setTimeout(initGlow, 500);
  });
})();
