const transcriptId = location.pathname.split("/").filter(Boolean).at(-1);
const customerView = /^\/transcripts\//i.test(location.pathname);
const loadingState = document.getElementById("loadingState");
const accessGate = document.getElementById("accessGate");
const ticketShell = document.getElementById("ticketShell");
const thread = document.getElementById("thread");

if (customerView) {
  const brand = document.querySelector(".brand");
  const brandLabel = brand?.querySelector("small");
  const backLink = document.querySelector(".topbar .back-link");
  if (brand) brand.href = "/account/";
  if (brandLabel) brandLabel.textContent = "Secure support transcript";
  if (backLink) {
    backLink.href = "/account/";
    backLink.textContent = "Back to account";
  }
  loadingState.querySelector(".eyebrow").textContent = "Identity check";
  loadingState.querySelector("h1").textContent = "Opening your transcript";
  loadingState.querySelector("p").textContent = "Confirming this ticket belongs to your linked Discord account.";
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function duration(minutes) {
  const value = Number(minutes || 0);
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

function displayDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function renderMessage(message) {
  const avatarUrl = safeUrl(message.avatarUrl);
  const role = message.role || (message.isBot ? "bot" : "user");
  const roleLabel = role === "staff" ? "STAFF" : role === "bot" ? "BOT" : "";
  const files = Array.isArray(message.attachments) ? message.attachments : [];
  const attachments = files.map((file) => {
    const url = safeUrl(file?.url);
    return url ? `<a class="attachment" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Attachment: ${esc(file.name || "file")}</a>` : "";
  }).join("");
  const avatar = avatarUrl
    ? `<img class="avatar" src="${esc(avatarUrl)}" alt="" referrerpolicy="no-referrer" />`
    : `<span class="avatar-fallback">${esc(initials(message.author))}</span>`;
  const timestamp = message.timestamp ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }).format(new Date(message.timestamp)) : "";

  return `<article class="message">
    ${avatar}
    <div>
      <div class="message-head"><span class="message-name">${esc(message.author || "Unknown")}</span>${roleLabel ? `<span class="message-role ${esc(role)}">${roleLabel}</span>` : ""}<span class="message-time">${esc(timestamp)}</span></div>
      <div class="message-body">${esc(message.content || "").replace(/\n/g, "<br>") || "<em>Message unavailable</em>"}</div>
      ${attachments ? `<div class="attachments">${attachments}</div>` : ""}
    </div>
  </article>`;
}

async function loadTranscript() {
  if (!transcriptId) throw new Error("Transcript ID is missing.");
  const endpoint = customerView
    ? `/api/transcripts/${encodeURIComponent(transcriptId)}`
    : `/api/admin/transcripts/${encodeURIComponent(transcriptId)}`;
  const response = await fetch(endpoint, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    loadingState.hidden = true;
    accessGate.hidden = false;
    if (customerView) {
      accessGate.querySelector(".eyebrow").textContent = "Discord verification required";
      accessGate.querySelector("h1").textContent = "Verify this ticket is yours.";
      accessGate.querySelector("p").textContent = "Continue with the Discord account that opened this support ticket. You will return here automatically.";
      const action = accessGate.querySelector("a");
      action.textContent = "Continue with Discord";
      action.href = `/api/auth/discord?returnTo=${encodeURIComponent(location.pathname)}`;
    }
    return;
  }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Unable to load transcript.");

  const { transcript } = await response.json();
  document.title = `${transcript.topic || "Ticket"} | XenCheats Transcript`;
  document.getElementById("ticketTopic").textContent = transcript.topic || "Support ticket";
  document.getElementById("ticketCreated").textContent = `Closed transcript from ${displayDate(transcript.created_at)}`;
  document.getElementById("ticketChannel").textContent = `#${transcript.channel_name || "ticket"}`;
  document.getElementById("ticketOpenedBy").textContent = transcript.opened_by || "Unknown";
  document.getElementById("ticketClosedBy").textContent = transcript.closed_by || "Unknown";
  document.getElementById("ticketDuration").textContent = duration(transcript.duration_minutes);
  document.getElementById("ticketCount").textContent = `${transcript.message_count || 0} logged`;
  const messages = Array.isArray(transcript.messages) ? transcript.messages : [];
  thread.innerHTML = messages.length ? messages.map(renderMessage).join("") : '<div class="empty-thread">No messages were saved for this ticket.</div>';
  loadingState.hidden = true;
  ticketShell.style.display = "block";
}

loadTranscript().catch((error) => {
  const returnHref = customerView ? "/account/" : "/desk-admin/";
  const returnLabel = customerView ? "Return to account" : "Return to staff desk";
  loadingState.innerHTML = `<div class="eyebrow">Transcript unavailable</div><h1>We could not open this record.</h1><p>${esc(error.message)}</p><a class="back-link" href="${returnHref}">${returnLabel}</a>`;
});
