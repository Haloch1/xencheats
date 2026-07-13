/* Social proof: a small floating toast that cycles recent purchases.
   Privacy-safe — the server only sends a masked buyer label. */

function timeAgo(ts) {
  const then = new Date(ts).getTime();
  if (!then) return "recently";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export async function initSocialProof() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isHomepage = path === "/" || path === "/index.html";

  if (!isHomepage) {
    return;
  }

  let data;
  try {
    const res = await fetch("/api/recent-purchases");
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }

  const recent = Array.isArray(data?.recent) ? data.recent : [];
  if (!recent.length) return;

  const toast = document.createElement("div");
  toast.className = "social-proof-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <button class="social-proof-close" aria-label="Dismiss">&times;</button>
    <div class="social-proof-body"></div>
  `;
  document.body.appendChild(toast);

  const body = toast.querySelector(".social-proof-body");
  const closeBtn = toast.querySelector(".social-proof-close");
  let dismissed = false;
  let idx = 0;

  closeBtn.addEventListener("click", () => {
    dismissed = true;
    toast.classList.remove("show");
  });

  const countLine = data.count24h > 0
    ? `<span class="social-proof-count">${data.count24h} purchase${data.count24h === 1 ? "" : "s"} in the last 24h</span>`
    : "";

  function render(item) {
    body.innerHTML = `
      <span class="social-proof-dot"></span>
      <div>
        <strong>${esc(item.buyer)}</strong> purchased <strong>${esc(item.product)}</strong>
        <span class="social-proof-time">${esc(timeAgo(item.ts))}</span>
        ${countLine}
      </div>
    `;
  }

  function cycle() {
    if (dismissed) return;
    render(recent[idx % recent.length]);
    idx += 1;
    toast.classList.add("show");
    setTimeout(() => {
      if (!dismissed) toast.classList.remove("show");
    }, 5000);
    setTimeout(cycle, 9000);
  }

  setTimeout(cycle, 3000);
}
