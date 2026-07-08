export function initReveal() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!revealItems.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const delay = entry.target.dataset.delay || "0";
        entry.target.style.setProperty("--reveal-delay", `${delay}ms`);
        entry.target.classList.add("is-visible");

        /* Once the reveal finishes, drop the reveal classes entirely so the
           element loses its GPU layer and hover effects use their own,
           faster transitions instead of the 1100ms reveal timing. */
        window.setTimeout(() => {
          entry.target.classList.remove("reveal", "is-visible");
          entry.target.style.removeProperty("--reveal-delay");
        }, (Number(delay) || 0) + 1250);

        activeObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0,
      rootMargin: "0px 0px -30px 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));
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
  const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!fineHover || reducedMotion) {
    return;
  }

  const selector = ".product-card, .catalog-category-card";
  const maxTilt = 6;
  let activeCard = null;
  let lastEvent = null;
  let frame = 0;

  const resetCard = (card) => {
    card.classList.remove("is-tilting");
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--glare-x");
    card.style.removeProperty("--glare-y");
  };

  const applyTilt = () => {
    frame = 0;

    if (!activeCard || !lastEvent) {
      return;
    }

    const rect = activeCard.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(Math.max((lastEvent.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((lastEvent.clientY - rect.top) / rect.height, 0), 1);

    activeCard.style.setProperty("--tilt-x", `${((0.5 - y) * maxTilt).toFixed(2)}deg`);
    activeCard.style.setProperty("--tilt-y", `${((x - 0.5) * maxTilt).toFixed(2)}deg`);
    activeCard.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
    activeCard.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
  };

  document.addEventListener("pointerover", (event) => {
    const card = event.target.closest?.(selector);

    if (!card || card === activeCard) {
      return;
    }

    if (activeCard) {
      resetCard(activeCard);
    }

    activeCard = card;
    card.classList.add("is-tilting");
  });

  document.addEventListener("pointerout", (event) => {
    if (!activeCard || activeCard.contains(event.relatedTarget)) {
      return;
    }

    if (!activeCard.contains(event.target)) {
      return;
    }

    resetCard(activeCard);
    activeCard = null;
    lastEvent = null;
  });

  document.addEventListener("pointermove", (event) => {
    if (!activeCard) {
      return;
    }

    lastEvent = event;

    if (!frame) {
      frame = requestAnimationFrame(applyTilt);
    }
  });
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
