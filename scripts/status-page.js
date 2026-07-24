import { initReveal } from "./site.js";

const checks = document.getElementById("statusChecks");
const updated = document.getElementById("statusUpdated");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status unavailable");
    const payload = await response.json();
    updated.textContent = `Last checked ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.updatedAt))}`;
    checks.innerHTML = payload.checks.map((check) => `<article><p class="eyebrow" style="color:${check.status === "operational" ? "var(--green)" : "var(--amber)"}">${escapeHtml(check.status)}</p><h3>${escapeHtml(check.name)}</h3><p>${escapeHtml(check.detail)}</p></article>`).join("");
  } catch {
    updated.textContent = "Status check unavailable. Please try again shortly.";
  }
}

initReveal();
loadStatus();
setInterval(loadStatus, 60_000);
