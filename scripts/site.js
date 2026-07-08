import { getCurrentSession } from "./supabase-client.js";

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

  const selector = ".product-card, .catalog-category-card";
  const tiltScale = reducedMotion ? 0.65 : 1;
  const shiftScale = reducedMotion ? 0 : 1;
  const maxTilt = 18;
  const maxShift = 5;
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
    const tiltX = (0.5 - y) * maxTilt * tiltScale;
    const tiltY = (x - 0.5) * maxTilt * tiltScale;
    const shiftX = (0.5 - x) * maxShift * shiftScale;
    const shiftY = (0.5 - y) * maxShift * shiftScale;

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

function initWallet() {
  if (document.querySelector(".cart-fab")) {
    return;
  }

  /* Floating cart button — only appears once the cart has items, so it stays
     out of the way and keeps the topbar clean. Balance lives on the account page. */
  const cartBtn = document.createElement("button");
  cartBtn.type = "button";
  cartBtn.className = "cart-fab";
  cartBtn.hidden = true;
  cartBtn.setAttribute("aria-label", "Open cart");
  cartBtn.innerHTML = `<span class="cart-ico" aria-hidden="true"></span><span class="cart-count" hidden>0</span>`;
  document.body.appendChild(cartBtn);

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
        <button type="button" class="button button-primary cart-checkout" data-cart-checkout>Checkout with Balance</button>
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

  function renderBadge() {
    const count = haloCartCount();
    cartCountEl.textContent = String(count);
    cartCountEl.hidden = count === 0;
    cartBtn.hidden = count === 0;
  }

  function renderDrawer() {
    const items = haloReadCart();
    if (!items.length) {
      itemsEl.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
    } else {
      itemsEl.innerHTML = items
        .map((it, i) => `
          <div class="cart-item">
            <div class="cart-item-info">
              <strong>${haloEscape(it.productName)}</strong>
              <span>${haloEscape(it.variantName || "")}</span>
            </div>
            <div class="cart-item-controls">
              <button type="button" class="cart-qty-btn" data-cart-dec="${i}" aria-label="Decrease">-</button>
              <span class="cart-qty">${Number(it.qty) || 1}</span>
              <button type="button" class="cart-qty-btn" data-cart-inc="${i}" aria-label="Increase">+</button>
            </div>
            <div class="cart-item-price">${haloMoney((Number(it.priceCents) || 0) * (Number(it.qty) || 1))}</div>
            <button type="button" class="cart-remove" data-cart-remove="${i}" aria-label="Remove">&times;</button>
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
      const count = (data.delivered || []).length;
      showCartMessage(`${count} key${count === 1 ? "" : "s"} delivered — view them on your account page.`, "success");
      checkoutBtn.textContent = original;
    } catch (err) {
      showCartMessage(err instanceof Error ? err.message : "Checkout failed.", "error");
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = original;
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
      }
      return b;
    },
  };

  renderBadge();
}

initWallet();
