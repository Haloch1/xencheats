import { getCurrentSession } from "./supabase-client.js";

const BRAND_NAME = "XenCheats";

function initBrandIdentity() {
  const replaceBrand = (value) => value
    .replaceAll("XenCheats", BRAND_NAME)
    .replaceAll("XenCheats", BRAND_NAME)
    .replaceAll("XENCHEATS", BRAND_NAME.toUpperCase())
    .replaceAll("Nox Menu", "Flux Menu")
    .replaceAll("NOX MENU", "FLUX MENU");

  document.title = replaceBrand(document.title);

  document.querySelectorAll("meta[content]").forEach((meta) => {
    meta.content = replaceBrand(meta.content);
  });

  document.querySelectorAll("[aria-label], [alt], [title]").forEach((element) => {
    ["aria-label", "alt", "title"].forEach((attribute) => {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, replaceBrand(element.getAttribute(attribute) || ""));
      }
    });
  });

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();

  while (node) {
    if (!node.parentElement?.closest("script, style, template")) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    textNode.nodeValue = replaceBrand(textNode.nodeValue || "");
  });
}

initBrandIdentity();

export function initReveal() {
  const revealItems = [...document.querySelectorAll(".reveal:not(.is-visible)")];

  if (!revealItems.length) {
    return;
  }

  const showItem = (item) => {
    if (item.classList.contains("is-visible")) {
      return;
    }

    const delay = item.dataset.delay || "0";
    item.style.setProperty("--reveal-delay", `${delay}ms`);
    item.classList.add("is-visible");

    /* Drop the GPU hint after the reveal, but keep the visible state so
       sections do not snap if initReveal() runs again on dynamic pages. */
    window.setTimeout(() => {
      item.classList.add("reveal-complete");
      item.style.removeProperty("--reveal-delay");
    }, (Number(delay) || 0) + 1350);
  };

  const remainingItems = new Set(revealItems);
  let scrollFrame = 0;

  const revealVisibleItems = () => {
    scrollFrame = 0;
    const triggerY = window.innerHeight * 0.78;

    remainingItems.forEach((item) => {
      const rect = item.getBoundingClientRect();

      if (rect.top <= triggerY && rect.bottom >= 0) {
        showItem(item);
        remainingItems.delete(item);
      }
    });

    if (!remainingItems.size) {
      window.removeEventListener("scroll", requestRevealCheck);
      window.removeEventListener("resize", requestRevealCheck);
    }
  };

  const requestRevealCheck = () => {
    if (!scrollFrame) {
      scrollFrame = window.requestAnimationFrame(revealVisibleItems);
    }
  };

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        showItem(entry.target);
        remainingItems.delete(entry.target);
        activeObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -18% 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));
  window.addEventListener("scroll", requestRevealCheck, { passive: true });
  window.addEventListener("resize", requestRevealCheck);
  requestRevealCheck();
}

/* ── Highlight the current page in the nav ── */
function initCurrentNav() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  document.querySelectorAll(".nav a").forEach((link) => {
    if (link.origin !== window.location.origin) {
      return;
    }

    const linkPath = link.pathname.replace(/\/+$/, "") || "/";

    if (linkPath === path) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    }
  });
}

initCurrentNav();

/* Page scroll progress rail */
function initScrollProgress() {
  const existingBar = document.querySelector(".scroll-progress");
  const progressBar = existingBar || document.createElement("div");
  let progressFrame = 0;

  if (!existingBar) {
    progressBar.className = "scroll-progress";
    progressBar.setAttribute("aria-hidden", "true");
    document.body.prepend(progressBar);
  }

  const updateProgress = () => {
    progressFrame = 0;

    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
    const maxScroll = Math.max(scrollHeight - window.innerHeight, 0);
    const progress = maxScroll > 0 ? Math.min(Math.max(scrollTop / maxScroll, 0), 1) : 1;

    progressBar.style.setProperty("--scroll-progress", progress.toFixed(4));
    progressBar.classList.toggle("is-complete", progress >= 0.995);
  };

  const requestProgressUpdate = () => {
    if (!progressFrame) {
      progressFrame = window.requestAnimationFrame(updateProgress);
    }
  };

  window.addEventListener("scroll", requestProgressUpdate, { passive: true });
  window.addEventListener("resize", requestProgressUpdate);
  window.addEventListener("load", requestProgressUpdate, { once: true });
  requestProgressUpdate();
}

initScrollProgress();

/* ── Interactive tilt for product & category cards ── */
function initCardTilt() {
  const supportsCursorHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supportsCursorHover) {
    return;
  }

  const selector = ".product-card:not(.popular-tilt-card), .catalog-category-card";
  const tiltScale = reducedMotion ? 0.65 : 1;
  const shiftScale = reducedMotion ? 0 : 1;
  const maxTilt = 9;
  const maxShift = 4;
  let activeCard = null;
  const returnTimers = new WeakMap();
  const returnAnimations = new WeakMap();
  const enterAnimations = new WeakMap();

  const clearCardVars = (card) => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--content-shift-x");
    card.style.removeProperty("--content-shift-y");
    card.style.removeProperty("--image-shift-x");
    card.style.removeProperty("--image-shift-y");
    card.style.removeProperty("--glare-x");
    card.style.removeProperty("--glare-y");
  };

  const clearReturnTimer = (card) => {
    const timer = returnTimers.get(card);
    const animation = returnAnimations.get(card);

    if (timer) {
      window.clearTimeout(timer);
      returnTimers.delete(card);
    }

    if (animation) {
      animation.cancel();
      returnAnimations.delete(card);
    }
  };

  const clearEnterTimer = (card) => {
    const animation = enterAnimations.get(card);

    if (animation) {
      animation.cancel();
      enterAnimations.delete(card);
    }
  };

  const resetCard = (card) => {
    if (!card) {
      return;
    }

    clearReturnTimer(card);
    clearEnterTimer(card);
    card.classList.add("is-returning");
    card.classList.remove("is-tilting");
    card.style.setProperty("--content-shift-x", "0px");
    card.style.setProperty("--content-shift-y", "0px");
    card.style.setProperty("--image-shift-x", "0px");
    card.style.setProperty("--image-shift-y", "0px");
    card.style.setProperty("--glare-x", "50%");
    card.style.setProperty("--glare-y", "50%");

    /* Ease the inline transform back to flat with a single plain CSS transition.
       The current value (set by updateCard) and the target are both
       perspective()/translate3d()/rotate() strings with identical primitives,
       so the browser interpolates each component smoothly. No Web Animations,
       no matrix decompose, nothing to hand off or pop at the end. */
    card.style.transition =
      "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), border-color 300ms ease, box-shadow 300ms ease";
    card.style.transform =
      "perspective(900px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)";

    returnTimers.set(
      card,
      window.setTimeout(() => {
        card.classList.remove("is-returning");
        card.style.removeProperty("transition");
        card.style.removeProperty("transform");
        clearCardVars(card);
        returnTimers.delete(card);
      }, 500),
    );
  };

  const updateCard = (card, event) => {
    const rect = card.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    const tiltX = (0.5 - y) * maxTilt * tiltScale;
    const tiltY = (x - 0.5) * maxTilt * tiltScale;
    const shiftX = (0.5 - x) * maxShift * shiftScale;
    const shiftY = (0.5 - y) * maxShift * shiftScale;
    const imageShiftX = (x - 0.5) * maxShift * 1.8 * shiftScale;
    const imageShiftY = (y - 0.5) * maxShift * 1.8 * shiftScale;
    const wasTilting = card.classList.contains("is-tilting");
    const entryStartTransform = card.classList.contains("is-returning")
      ? window.getComputedStyle(card).transform
      : "perspective(900px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)";
    const targetTransform = `perspective(900px) translate3d(0, -6px, 18px) rotateX(${tiltX.toFixed(
      2,
    )}deg) rotateY(${tiltY.toFixed(2)}deg)`;

    clearReturnTimer(card);
    card.classList.remove("is-returning");
    card.classList.add("is-tilting");
    card.style.transition = "border-color 220ms ease, box-shadow 220ms ease";
    card.style.transform = targetTransform;

    if (!wasTilting) {
      clearEnterTimer(card);

      if (card.animate) {
        const animation = card.animate(
          [
            { transform: entryStartTransform },
            { transform: targetTransform },
          ],
          {
            duration: 150,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );

        enterAnimations.set(card, animation);
        animation.finished
          .then(() => {
            if (enterAnimations.get(card) === animation) {
              enterAnimations.delete(card);
            }
          })
          .catch(() => {});
      }
    } else {
      clearEnterTimer(card);
    }

    card.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    card.style.setProperty("--content-shift-x", `${shiftX.toFixed(2)}px`);
    card.style.setProperty("--content-shift-y", `${shiftY.toFixed(2)}px`);
    card.style.setProperty("--image-shift-x", `${imageShiftX.toFixed(2)}px`);
    card.style.setProperty("--image-shift-y", `${imageShiftY.toFixed(2)}px`);
    card.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
  };

  const handleCardMove = (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    const directCard = event.target.closest?.(selector);
    const pointTarget = document.elementFromPoint?.(event.clientX, event.clientY);
    const card = directCard || pointTarget?.closest?.(selector);

    if (!card) {
      if (activeCard) {
        resetCard(activeCard);
        activeCard = null;
      }
      return;
    }

    if (activeCard && activeCard !== card) {
      resetCard(activeCard);
    }

    activeCard = card;
    updateCard(card, event);
  };

  const handleCardOut = (event) => {
    if (!activeCard || activeCard.contains(event.relatedTarget)) {
      return;
    }

    resetCard(activeCard);
    activeCard = null;
  };

  document.addEventListener("pointermove", handleCardMove, true);
  document.addEventListener("pointerout", handleCardOut, true);
}

/* Cursor-following card tilt is intentionally disabled. */

/* ── Moving red border for category cards: drive the conic-gradient angle from
   JS so it animates even when the OS/browser has "reduce motion" enabled (that
   was freezing the CSS version on desktop). Runs only where category cards live. ── */
function initCategoryBorderGlow() {
  if (!document.querySelector("[data-products-grid], [data-popular-grid]")) {
    return;
  }
  const root = document.documentElement;
  let angle = 0;
  let last = null;
  function step(now) {
    if (last !== null) {
      angle = (angle + (now - last) * 0.055) % 360;
    }
    last = now;
    root.style.setProperty("--hc-cat-angle", `${angle.toFixed(2)}deg`);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
initCategoryBorderGlow();

/* Lightweight cursor tilt for homepage popular cards. */
function initPopularCardTilt() {
  const supportsCursorHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!supportsCursorHover) {
    return;
  }

  const selector = ".product-grid[data-popular-grid] > .product-card.popular-tilt-card";
  const maxTilt = 5;
  const maxShift = 3;
  let activeCard = null;
  const returnTimers = new WeakMap();

  const clearReturn = (card) => {
    const timer = returnTimers.get(card);

    if (timer) {
      window.clearTimeout(timer);
      returnTimers.delete(card);
    }
  };

  const updatePopularCard = (card, event) => {
    const rect = card.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    const tiltX = (0.5 - y) * maxTilt;
    const tiltY = (x - 0.5) * maxTilt;
    const shiftX = (0.5 - x) * maxShift;
    const shiftY = (0.5 - y) * maxShift;

    clearReturn(card);
    card.classList.remove("is-popular-returning");
    card.classList.add("is-popular-tilting");
    card.style.transition = "border-color 180ms ease, box-shadow 180ms ease";
    card.style.transform = `perspective(950px) translate3d(0, -7px, 14px) rotateX(${tiltX.toFixed(
      2,
    )}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    card.style.setProperty("--content-shift-x", `${shiftX.toFixed(2)}px`);
    card.style.setProperty("--content-shift-y", `${shiftY.toFixed(2)}px`);
    card.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
  };

  const resetPopularCard = (card) => {
    if (!card) {
      return;
    }

    clearReturn(card);
    card.classList.remove("is-popular-tilting");
    card.classList.add("is-popular-returning");
    card.style.transition =
      "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms ease, box-shadow 220ms ease";
    card.style.transform = "perspective(950px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg)";
    card.style.setProperty("--content-shift-x", "0px");
    card.style.setProperty("--content-shift-y", "0px");
    card.style.setProperty("--glare-x", "50%");
    card.style.setProperty("--glare-y", "50%");

    returnTimers.set(
      card,
      window.setTimeout(() => {
        card.classList.remove("is-popular-returning");
        card.style.removeProperty("transition");
        card.style.removeProperty("transform");
        card.style.removeProperty("--content-shift-x");
        card.style.removeProperty("--content-shift-y");
        card.style.removeProperty("--glare-x");
        card.style.removeProperty("--glare-y");
        returnTimers.delete(card);
      }, 280),
    );
  };

  document.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      const card = event.target.closest?.(selector);

      if (!card) {
        if (activeCard) {
          resetPopularCard(activeCard);
          activeCard = null;
        }
        return;
      }

      if (activeCard && activeCard !== card) {
        resetPopularCard(activeCard);
      }

      activeCard = card;
      updatePopularCard(card, event);
    },
    true,
  );

  document.addEventListener(
    "pointerout",
    (event) => {
      if (!activeCard || activeCard.contains(event.relatedTarget)) {
        return;
      }

      resetPopularCard(activeCard);
      activeCard = null;
    },
    true,
  );
}

/* Homepage cursor-following tilt is intentionally disabled. */

/* ── Compact topbar once the page scrolls ── */
function initTopbarScroll() {
  const topbar = document.querySelector(".topbar");

  if (!topbar) {
    return;
  }

  const update = () => {
    topbar.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

initTopbarScroll();

function initNavIcons() {
  const icons = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    products: '<path d="m7.5 4.3 9 5.1"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    reviews: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
    help: '<path d="M8.8 9a3.3 3.3 0 1 1 5.7 2.2c-1.5 1.4-2.5 1.7-2.5 3.3"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="9"/>',
    discord: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M7.5 7.2A17 17 0 0 1 12 6.5c1.6 0 3.1.2 4.5.7M7 16.8c1.4.5 3 .7 5 .7s3.6-.2 5-.7"/><path d="M17.3 6.6S19 7 20.4 9.8c1.3 2.8 1.5 5.6.6 7.2-.8 1.4-2.1 3-3.5 3-.5 0-2-2-2-3M6.7 6.6S5 7 3.6 9.8C2.3 12.6 2.1 15.4 3 17c.8 1.4 2.1 3 3.5 3 .5 0 2-2 2-3"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  };

  document.querySelectorAll(".topbar .nav a, .topbar .nav-cta").forEach((link) => {
    if (link.querySelector("svg")) return;

    const href = link.getAttribute("href") || "";
    let icon = "account";
    if (/discord/i.test(href)) icon = "discord";
    else if (/products/i.test(href)) icon = "products";
    else if (/reviews/i.test(href)) icon = "reviews";
    else if (/desk|help/i.test(href)) icon = "help";
    else if (href === "/" || /home/i.test(link.textContent || "")) icon = "home";

    link.insertAdjacentHTML(
      "afterbegin",
      `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg>`,
    );
  });
}

initNavIcons();

function initSharedFooter() {
  const inner = document.querySelector(".site-footer .footer-inner");
  if (!inner) return;

  const footer = inner.closest(".site-footer");
  if (footer && !footer.id) footer.id = "site-footer";

  if (!inner.classList.contains("footer-grid")) {
    inner.classList.add("footer-grid");
    inner.innerHTML = `
      <div class="footer-about">
        <div class="footer-brand">
          <img src="/assets/nox-logo.png" alt="XenCheats logo" />
          <strong>XenCheats</strong>
        </div>
        <p>Premium game enhancements with <strong>instant delivery</strong>, protected access, and support that responds.</p>
        <div class="footer-trust"><span>Instant Delivery</span><span>Secure Checkout</span><span>24/7 Desk</span></div>
      </div>
      <nav class="footer-col" aria-label="Store links"><strong>Store</strong><a href="/products/">Products</a><a href="/reviews/">Reviews</a><a href="/instructions/">Setup Guides</a></nav>
      <nav class="footer-col" aria-label="Support links"><strong>Support</strong><a href="/desk/">Help Desk</a><a href="/account/">Your Account</a><a href="https://discord.gg/xencheats" target="_blank" rel="noreferrer">Discord</a></nav>
      <nav class="footer-col" aria-label="Company links"><strong>Company</strong><a href="/terms/">Terms of Service</a><a href="/privacy/">Privacy Policy</a></nav>
      <div class="footer-copy">&copy; <span data-year></span> XenCheats. All rights reserved.</div>
    `;
  }

  // Keep the logo and brand together even on pages with a hand-written footer.
  const footerBrand = inner.querySelector(".footer-brand");
  if (footerBrand && !footerBrand.querySelector("img")) {
    footerBrand.insertAdjacentHTML("afterbegin", '<img src="/assets/nox-logo.png" alt="XenCheats logo" />');
  }

  inner.querySelectorAll("[data-year]").forEach((year) => {
    year.textContent = String(new Date().getFullYear());
  });
}

initSharedFooter();

export function renderMessage(target, message, tone = "info") {
  if (!target) {
    return;
  }

  target.hidden = false;
  target.textContent = message;
  target.className = `inline-message ${tone}`;
}

export function currencyLabel(value) {
  return typeof value === "number" ? `$${value.toFixed(2)}` : value;
}

const VISITOR_ID_STORAGE = "halo-anonymous-visitor-id";
const VISITOR_HEARTBEAT_MS = 30_000;
let fallbackVisitorId = "";

function createVisitorId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

function getVisitorId() {
  try {
    const existingId = window.localStorage.getItem(VISITOR_ID_STORAGE);

    if (existingId) {
      return existingId;
    }

    const visitorId = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE, visitorId);
    return visitorId;
  } catch {
    fallbackVisitorId ||= createVisitorId();
    return fallbackVisitorId;
  }
}

function sendVisitorHeartbeat() {
  if (document.visibilityState === "hidden") {
    return;
  }

  window
    .fetch("/api/visitors/heartbeat", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        pagePath: `${window.location.pathname}${window.location.search}`,
        referrer: document.referrer,
      }),
      keepalive: true,
    })
    .catch(() => {});
}

sendVisitorHeartbeat();
window.setInterval(sendVisitorHeartbeat, VISITOR_HEARTBEAT_MS);
document.addEventListener("visibilitychange", sendVisitorHeartbeat);

/* ── Nav auto-scroll on mobile ── */
function initNavAutoScroll() {
  const nav = document.querySelector(".nav");
  if (!nav || window.innerWidth > 760) return;

  let scrollPos = 0;
  let direction = 1;
  let paused = false;
  let pauseTimeout = null;

  function step() {
    if (!paused && nav.scrollWidth > nav.clientWidth) {
      const maxScroll = nav.scrollWidth - nav.clientWidth;
      scrollPos += 0.5 * direction;

      if (scrollPos >= maxScroll) {
        scrollPos = maxScroll;
        direction = -1;
      } else if (scrollPos <= 0) {
        scrollPos = 0;
        direction = 1;
      }

      nav.scrollLeft = scrollPos;
    }
    requestAnimationFrame(step);
  }

  // Pause on touch
  nav.addEventListener("touchstart", () => {
    paused = true;
    clearTimeout(pauseTimeout);
  }, { passive: true });

  nav.addEventListener("touchend", () => {
    pauseTimeout = setTimeout(() => {
      scrollPos = nav.scrollLeft;
      paused = false;
    }, 3000);
  }, { passive: true });

  // Start after a short delay
  setTimeout(() => requestAnimationFrame(step), 1500);
}

initNavAutoScroll();

/* ── Site banner (managed via Discord /banner) ── */
async function initSiteBanner() {
  try {
    const res = await fetch("/api/banner");
    if (!res.ok) return;
    const b = await res.json();
    if (!b || !b.active || !b.message) return;
    const bar = document.createElement("div");
    bar.className = "site-banner";
    if (b.color && /^#?[0-9a-fA-F]{3,8}$/.test(b.color)) {
      bar.style.background = b.color.startsWith("#") ? b.color : "#" + b.color;
    }
    bar.textContent = b.message;
    document.body.prepend(bar);
    document.body.classList.add("has-site-banner");
  } catch {}
}

initSiteBanner();

/* ── Wallet balance pill + cart (shared across all pages via site.js) ── */
const HALO_CART_KEY = "hc_cart";
let haloBalanceCents = 0;

function haloReadCart() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HALO_CART_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function haloWriteCart(items) {
  try {
    window.localStorage.setItem(HALO_CART_KEY, JSON.stringify(items));
  } catch {}
}

function haloCartCount(items = haloReadCart()) {
  return items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
}

function haloCartTotalCents(items = haloReadCart()) {
  return items.reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.qty) || 1), 0);
}

function haloMoney(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function haloEscape(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

async function haloFetchBalance() {
  try {
    const session = await getCurrentSession();
    if (!session?.access_token) return null;
    const res = await fetch("/api/balance", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Number(data.balanceCents) || 0;
  } catch {
    return null;
  }
}

async function haloFetchRole() {
  try {
    const session = await getCurrentSession();

    if (!session?.access_token) {
      return null;
    }

    const response = await fetch("/api/auth/role", {
      credentials: "same-origin",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload.role || null;
  } catch {
    return null;
  }
}

function initWallet() {
  const shell = document.querySelector(".topbar-shell");
  if (!shell || shell.querySelector(".topbar-wallet")) {
    return;
  }

  const accountCta = shell.querySelector(".nav-cta");
  const accountLink = shell.querySelector(".nav-cta[data-account-link]");

  /* Collapse the "Account" text button into a compact icon-only button. */
  if (accountLink) {
    accountLink.classList.add("nav-cta-icon");
    accountLink.setAttribute("aria-label", "Account");
    accountLink.textContent = "";
  }

  const wrap = document.createElement("div");
  wrap.className = "topbar-wallet";

  const balancePill = document.createElement("a");
  balancePill.className = "balance-pill";
  balancePill.href = "/account/";
  balancePill.hidden = true;
  balancePill.setAttribute("aria-label", "Your balance");
  balancePill.innerHTML = `<span class="balance-ico" aria-hidden="true"></span><span class="balance-amount">$0.00</span>`;

  const cartBtn = document.createElement("button");
  cartBtn.type = "button";
  cartBtn.className = "cart-button";
  cartBtn.setAttribute("aria-label", "Open cart");
  cartBtn.innerHTML = `
    <svg class="cart-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
    </svg>
    <span class="cart-count" hidden>0</span>`;

  wrap.appendChild(balancePill);
  wrap.appendChild(cartBtn);

  haloFetchRole().then((role) => {
    if (role !== "admin" && role !== "staff") {
      return;
    }

    if (wrap.querySelector(".staff-pill")) {
      return;
    }

    const staffLink = document.createElement("a");
    staffLink.className = `staff-pill ${role === "admin" ? "is-admin" : "is-staff"}`;
    staffLink.href = role === "admin" ? "/admin/" : "/desk-admin/";
    staffLink.textContent = role === "admin" ? "Admin" : "Staff";
    staffLink.setAttribute(
      "aria-label",
      role === "admin" ? "Open admin panel" : "Open staff desk"
    );
    wrap.prepend(staffLink);
  });

  /* Move the account button into the wallet group so balance + cart + account
     sit together, tightly spaced, on the right side of the topbar. */
  if (accountCta) {
    wrap.appendChild(accountCta);
  }
  shell.appendChild(wrap);

  const drawer = document.createElement("div");
  drawer.className = "cart-drawer";
  drawer.hidden = true;
  drawer.innerHTML = `
    <div class="cart-drawer-backdrop" data-cart-close></div>
    <aside class="cart-panel" role="dialog" aria-label="Shopping cart">
      <div class="cart-panel-head">
        <strong>Your Cart</strong>
        <button type="button" class="cart-close" data-cart-close aria-label="Close cart">&times;</button>
      </div>
      <div class="cart-items" data-cart-items></div>
      <div class="cart-foot">
        <div class="cart-summary-row">
          <span>Balance</span>
          <strong data-cart-balance>$0.00</strong>
        </div>
        <div class="cart-summary-row cart-total-row">
          <span>Total</span>
          <strong data-cart-total>$0.00</strong>
        </div>
        <p class="cart-message" data-cart-message hidden></p>
        <button type="button" class="button button-balance cart-checkout" data-cart-checkout>Checkout with Balance</button>
        <button type="button" class="button button-primary cart-checkout" data-cart-stripe>Checkout with Card (Stripe)</button>
        <a class="button button-secondary cart-topup" href="/account/">Add Funds</a>
      </div>
    </aside>
  `;
  document.body.appendChild(drawer);

  const cartCountEl = cartBtn.querySelector(".cart-count");
  const itemsEl = drawer.querySelector("[data-cart-items]");
  const totalEl = drawer.querySelector("[data-cart-total]");
  const balanceEl = drawer.querySelector("[data-cart-balance]");
  const messageEl = drawer.querySelector("[data-cart-message]");
  const checkoutBtn = drawer.querySelector("[data-cart-checkout]");

  function updateBalancePill() {
    const amountEl = balancePill.querySelector(".balance-amount");
    if (amountEl) {
      amountEl.textContent = haloMoney(haloBalanceCents);
    }
  }

  function renderBadge() {
    const count = haloCartCount();
    cartCountEl.textContent = String(count);
    cartCountEl.hidden = count === 0;
  }

  function renderDrawer() {
    const items = haloReadCart();
    if (!items.length) {
      itemsEl.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
    } else {
      itemsEl.innerHTML = items
        .map((it, i) => `
          <div class="cart-item">
            <div class="cart-item-media">
              <img class="cart-item-media-blur" src="${haloEscape(it.imageSrc || "/assets/nox-logo.png")}" alt="" aria-hidden="true" />
              <img src="${haloEscape(it.imageSrc || "/assets/nox-logo.png")}" alt="${haloEscape(it.productName)}" />
            </div>
            <div class="cart-item-info">
              <strong>${haloEscape(it.productName)}</strong>
              <span>${haloEscape(it.variantName || "")}</span>
            </div>
            <div class="cart-item-controls">
              <button type="button" class="cart-qty-btn" data-cart-dec="${i}" aria-label="Decrease">-</button>
              <span class="cart-qty">${Number(it.qty) || 1}</span>
              <button type="button" class="cart-qty-btn" data-cart-inc="${i}" aria-label="Increase">+</button>
              <div class="cart-item-price">${haloMoney((Number(it.priceCents) || 0) * (Number(it.qty) || 1))}</div>
              <button type="button" class="cart-remove" data-cart-remove="${i}" aria-label="Remove">&times;</button>
            </div>
          </div>
        `)
        .join("");
    }
    totalEl.textContent = haloMoney(haloCartTotalCents(items));
    balanceEl.textContent = haloMoney(haloBalanceCents);
    checkoutBtn.disabled = !items.length;
  }

  function showCartMessage(msg, tone) {
    if (!messageEl) return;
    messageEl.hidden = false;
    messageEl.textContent = msg;
    messageEl.className = `cart-message ${tone}`;
  }

  function openDrawer() {
    renderDrawer();
    drawer.hidden = false;
    document.body.classList.add("cart-open");
    haloFetchBalance().then((b) => {
      if (b !== null) {
        haloBalanceCents = b;
        balanceEl.textContent = haloMoney(b);
        balancePill.hidden = false;
        updateBalancePill();
      }
    });
  }

  function closeDrawer() {
    drawer.hidden = true;
    document.body.classList.remove("cart-open");
    if (messageEl) messageEl.hidden = true;
  }

  cartBtn.addEventListener("click", openDrawer);

  drawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-cart-close]")) {
      closeDrawer();
      return;
    }
    const inc = event.target.closest("[data-cart-inc]");
    const dec = event.target.closest("[data-cart-dec]");
    const rem = event.target.closest("[data-cart-remove]");
    if (!inc && !dec && !rem) {
      return;
    }
    const items = haloReadCart();
    if (inc) {
      const i = Number(inc.dataset.cartInc);
      items[i].qty = (Number(items[i].qty) || 1) + 1;
    } else if (dec) {
      const i = Number(dec.dataset.cartDec);
      items[i].qty = (Number(items[i].qty) || 1) - 1;
      if (items[i].qty < 1) items.splice(i, 1);
    } else if (rem) {
      items.splice(Number(rem.dataset.cartRemove), 1);
    }
    haloWriteCart(items);
    renderBadge();
    renderDrawer();
  });

  checkoutBtn.addEventListener("click", async () => {
    const items = haloReadCart();
    if (!items.length) {
      return;
    }
    const session = await getCurrentSession();
    if (!session?.access_token) {
      showCartMessage("Sign in first, then check out.", "warn");
      window.setTimeout(() => {
        window.location.href = `/account/?next=${encodeURIComponent(window.location.pathname)}`;
      }, 800);
      return;
    }

    checkoutBtn.disabled = true;
    const original = checkoutBtn.textContent;
    checkoutBtn.textContent = "Processing...";

    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: items.map((it) => ({
            productSlug: it.productSlug,
            variantSlug: it.variantSlug,
            quantity: it.qty,
          })),
        }),
      });
      const data = await res.json();

      if (res.status === 402) {
        haloBalanceCents = Number(data.balanceCents) || haloBalanceCents;
        balanceEl.textContent = haloMoney(haloBalanceCents);
        updateBalancePill();
        showCartMessage("Not enough balance. Add funds to your account first.", "error");
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = original;
        return;
      }

      if (!res.ok && res.status !== 207) {
        throw new Error(data.error || "Checkout failed.");
      }

      haloWriteCart([]);
      renderBadge();
      renderDrawer();
      haloBalanceCents = Number(data.balanceCents) || 0;
      balanceEl.textContent = haloMoney(haloBalanceCents);
      updateBalancePill();
      const count = (data.delivered || []).length;
      showCartMessage(`${count} key${count === 1 ? "" : "s"} delivered — view them on your account page.`, "success");
      checkoutBtn.textContent = original;
    } catch (err) {
      showCartMessage(err instanceof Error ? err.message : "Checkout failed.", "error");
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = original;
    }
  });

  const stripeBtn = drawer.querySelector("[data-cart-stripe]");
  stripeBtn?.addEventListener("click", async () => {
    const items = haloReadCart();
    if (!items.length) {
      return;
    }
    const session = await getCurrentSession();
    if (!session?.access_token) {
      showCartMessage("Sign in first, then check out.", "warn");
      window.setTimeout(() => {
        window.location.href = `/account/?next=${encodeURIComponent(window.location.pathname)}`;
      }, 800);
      return;
    }

    stripeBtn.disabled = true;
    const original = stripeBtn.textContent;
    stripeBtn.textContent = "Redirecting...";

    try {
      const res = await fetch("/api/cart/create-stripe-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: items.map((it) => ({
            productSlug: it.productSlug,
            variantSlug: it.variantSlug,
            quantity: it.qty,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to start checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      showCartMessage(err instanceof Error ? err.message : "Checkout failed.", "error");
      stripeBtn.disabled = false;
      stripeBtn.textContent = original;
    }
  });

  /* Public API used by the products page (add-to-cart, pay-with-balance refresh). */
  window.haloCart = {
    add(item) {
      const items = haloReadCart();
      const idx = items.findIndex(
        (it) => it.productSlug === item.productSlug && it.variantSlug === item.variantSlug
      );
      if (idx >= 0) {
        items[idx].qty = (Number(items[idx].qty) || 1) + (Number(item.qty) || 1);
      } else {
        items.push({ ...item, qty: Number(item.qty) || 1 });
      }
      haloWriteCart(items);
      renderBadge();
      renderDrawer();
    },
    open: openDrawer,
    count: haloCartCount,
    async refreshBalance() {
      const b = await haloFetchBalance();
      if (b !== null) {
        haloBalanceCents = b;
        balanceEl.textContent = haloMoney(b);
        balancePill.hidden = false;
        updateBalancePill();
      }
      return b;
    },
  };

  renderBadge();

  haloFetchBalance().then((b) => {
    if (b !== null) {
      haloBalanceCents = b;
      updateBalancePill();
      balancePill.hidden = false;
    }
  });
}

initWallet();
