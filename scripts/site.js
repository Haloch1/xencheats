export function initReveal() {
  const revealItems = [...document.querySelectorAll(".reveal:not(.is-visible)")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    }, (Number(delay) || 0) + 1050);
  };

  if (reducedMotion) {
    revealItems.forEach((item) => {
      item.classList.add("is-visible", "reveal-complete");
    });
    return;
  }

  const remainingItems = new Set(revealItems);
  let scrollFrame = 0;

  const revealVisibleItems = () => {
    scrollFrame = 0;
    const triggerY = window.innerHeight * 0.85;

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
      threshold: 0.15,
      rootMargin: "0px 0px -12% 0px",
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

/* ── Interactive tilt for product & category cards ── */
function initCardTilt() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const selector = ".product-card, .catalog-category-card";
  const maxTilt = 14;
  const maxShift = 8;
  let activeCard = null;

  const clearCardVars = (card) => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--content-shift-x");
    card.style.removeProperty("--content-shift-y");
    card.style.removeProperty("--glare-x");
    card.style.removeProperty("--glare-y");
  };

  const resetCard = (card) => {
    if (!card) {
      return;
    }

    card.classList.remove("is-tilting");
    clearCardVars(card);
  };

  const updateCard = (card, event) => {
    const rect = card.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    const tiltX = reducedMotion ? 0 : (0.5 - y) * maxTilt;
    const tiltY = reducedMotion ? 0 : (x - 0.5) * maxTilt;
    const shiftX = reducedMotion ? 0 : (0.5 - x) * maxShift;
    const shiftY = reducedMotion ? 0 : (0.5 - y) * maxShift;

    card.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    card.style.setProperty("--content-shift-x", `${shiftX.toFixed(2)}px`);
    card.style.setProperty("--content-shift-y", `${shiftY.toFixed(2)}px`);
    card.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
    card.classList.add("is-tilting");
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

  document.addEventListener("mousemove", handleCardMove, true);
  document.addEventListener("pointermove", handleCardMove, true);
  document.addEventListener("mouseout", handleCardOut, true);
  document.addEventListener("pointerout", handleCardOut, true);
}

initCardTilt();

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
