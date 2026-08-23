import { initReveal } from "./site.js";

initReveal();
const list = document.querySelector("[data-media-admin-list]");
const notice = document.querySelector("[data-media-admin-message]");
const memberList = document.querySelector("[data-media-member-list]");
const memberDetail = document.querySelector("[data-media-member-detail]");
const memberSearch = document.querySelector("[data-media-member-search]");

function esc(value) { const div = document.createElement("div"); div.textContent = value == null ? "" : String(value); return div.innerHTML; }
function safeHref(value) { try { const url = new URL(String(value || "")); return /^https?:$/.test(url.protocol) ? esc(url.href) : "#"; } catch { return "#"; } }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString(); }
function show(text, kind = "info") { notice.hidden = !text; notice.className = `inline-message ${kind}`; notice.textContent = text; }

function render(rows) {
  if (!rows.length) { list.innerHTML = `<p class="muted">No pending media requests.</p>`; return; }
  list.innerHTML = rows.map((row) => `<article class="media-review-item"><div class="media-review-main"><p class="eyebrow">${esc(row.status)}</p><h3>${esc(row.variant_label)}</h3><p>${esc(row.product_slug)} | member ${esc(row.discord_id || row.user_id)}</p>${row.proof_url ? `<a href="${safeHref(row.proof_url)}" target="_blank" rel="noreferrer">Open ${esc(row.proof_platform || "proof")} link</a>` : "<p class=\"muted\">Automatic Discord-role allowance</p>"}<p class="muted">${esc(row.note || "No note provided.")}</p><small>${esc(formatDate(row.created_at))}</small></div><div class="media-review-actions"><button class="button button-primary" data-review="approve" data-id="${esc(row.id)}">Approve</button><button class="button button-danger" data-review="reject" data-id="${esc(row.id)}">Reject</button></div></article>`).join("");
}

function renderMembers(rows) {
  if (!memberList) return;
  memberList.innerHTML = rows.length ? rows.map((member) => `<button type="button" class="media-member-row" data-member-id="${esc(member.discord_id)}"><strong>${esc(member.username || "Unknown member")}</strong><span>${esc(member.discord_id)} · ${esc(member.status || "unknown")}</span></button>`).join("") : `<p class="muted">No media members found.</p>`;
}

function renderMemberDetail(data) {
  if (!memberDetail) return;
  const content = data.content || [];
  const posts = data.posts || [];
  const contentById = new Map(content.map((item) => [String(item.id), item]));
  const contentCards = content.map((item) => `<article class="media-history-item"><div><span class="media-history-kind">Tracked submission</span><h3>${esc(item.content_id || "Pending ID")}</h3><p>${esc(item.game || "Game not specified")} · ${esc(item.status || "unknown")}</p><p class="muted">${esc(item.caption || "No caption provided.")}</p><small>${esc(formatDate(item.created_at))}</small></div>${item.video_url ? `<a class="button" href="${safeHref(item.video_url)}" target="_blank" rel="noreferrer">Open video</a>` : ""}</article>`).join("");
  const postCards = posts.map((post) => { const source = contentById.get(String(post.content_db_id)); return `<article class="media-history-item"><div><span class="media-history-kind">Reported post</span><h3>${esc(post.content_id || source?.content_id || "Tracked post")}</h3><p>${esc(post.platform || "Unknown platform")} · ${esc(post.status || "unknown")}</p><small>${esc(formatDate(post.created_at))}</small></div><a class="button" href="${safeHref(post.link)}" target="_blank" rel="noreferrer">Open link</a></article>`; }).join("");
  memberDetail.innerHTML = `<div class="media-member-detail-head"><div><p class="eyebrow">Selected creator</p><h2>${esc(data.member.username || "Unknown member")}</h2><p class="muted">${esc(data.member.discord_id)} · ${esc(data.member.status || "unknown")}</p></div><div class="media-history-counts"><strong>${content.length}</strong><span>submissions</span><strong>${posts.length}</strong><span>reported posts</span></div></div><div class="media-history-group"><h3>Tracked submissions</h3>${contentCards || `<p class="muted">No tracked submissions yet.</p>`}</div><div class="media-history-group"><h3>Reported placements</h3>${postCards || `<p class="muted">No reported placements yet.</p>`}</div>`;
}

async function load() { try { const response = await fetch("/api/admin/media/campaigns", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Staff access required."); render(data.campaigns || []); } catch (error) { show(error.message, "error"); list.innerHTML = ""; } }
async function loadMembers() { if (!memberList) return; memberList.innerHTML = `<p class="muted">Loading media members...</p>`; try { const query = new URLSearchParams(); if (memberSearch?.value.trim()) query.set("search", memberSearch.value.trim()); const response = await fetch(`/api/admin/media/members?${query}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Staff access required."); renderMembers(data.members || []); } catch (error) { memberList.innerHTML = `<p class="error-text">${esc(error.message)}</p>`; } }
async function loadMember(discordId) { if (!memberDetail) return; memberDetail.innerHTML = `<p class="muted">Loading tracked history...</p>`; try { const response = await fetch(`/api/admin/media/members?discordId=${encodeURIComponent(discordId)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to load member history."); renderMemberDetail(data); } catch (error) { memberDetail.innerHTML = `<p class="error-text">${esc(error.message)}</p>`; } }

list?.addEventListener("click", async (event) => { const button = event.target.closest("[data-review]"); if (!button) return; const note = window.prompt("Optional reviewer note:", ""); button.disabled = true; try { const response = await fetch(`/api/admin/media/campaigns/${button.dataset.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: button.dataset.review, note }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Review failed."); show(`Request ${data.status}.`, "success"); await load(); } catch (error) { show(error.message, "error"); button.disabled = false; } });
memberList?.addEventListener("click", (event) => { const button = event.target.closest("[data-member-id]"); if (button) loadMember(button.dataset.memberId); });
document.querySelector("[data-media-admin-refresh]")?.addEventListener("click", load);
document.querySelector("[data-media-member-refresh]")?.addEventListener("click", loadMembers);
memberSearch?.addEventListener("keydown", (event) => { if (event.key === "Enter") loadMembers(); });
load();
loadMembers();
