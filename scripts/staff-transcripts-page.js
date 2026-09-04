const loadingState = document.getElementById("loadingState");
const accessState = document.getElementById("accessState");
const library = document.getElementById("library");
const transcriptList = document.getElementById("transcriptList");
const refreshButton = document.getElementById("refreshButton");

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function duration(minutes) {
  const value = Number(minutes || 0);
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

function formatDate(value) {
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date),
    time: new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(date),
  };
}

function renderTranscripts(transcripts) {
  if (!transcripts.length) {
    transcriptList.innerHTML = '<div class="empty">No closed support transcripts yet.</div>';
    return;
  }

  transcriptList.innerHTML = transcripts.map((transcript) => {
    const { date, time } = formatDate(transcript.created_at);
    const href = `/admin/transcripts/${encodeURIComponent(transcript.id)}`;
    return `<article class="transcript-card">
      <div>
        <span class="transcript-topic">${esc(transcript.topic || "Support ticket")}</span>
        <span class="transcript-channel">#${esc(transcript.channel_name || "ticket")}</span>
        <div class="transcript-meta">
          <span>Opened by <b>${esc(transcript.opened_by || "Unknown")}</b></span>
          <span>Closed by <b>${esc(transcript.closed_by || "Unknown")}</b></span>
          <span><b>${esc(duration(transcript.duration_minutes))}</b> duration</span>
          <span><b>${esc(transcript.message_count || 0)}</b> messages</span>
        </div>
      </div>
      <div class="transcript-side"><span class="transcript-time">${esc(date)} · ${esc(time)}</span><a class="transcript-link" href="${href}">Open transcript</a></div>
    </article>`;
  }).join("");
}

async function loadTranscripts() {
  refreshButton.disabled = true;
  transcriptList.innerHTML = '<div class="empty">Loading records...</div>';
  try {
    const response = await fetch("/api/admin/transcripts", { credentials: "same-origin", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      library.hidden = true;
      loadingState.hidden = true;
      accessState.hidden = false;
      return;
    }
    if (!response.ok) throw new Error(payload.error || "Unable to load transcripts.");
    renderTranscripts(Array.isArray(payload.transcripts) ? payload.transcripts : []);
    loadingState.hidden = true;
    accessState.hidden = true;
    library.hidden = false;
  } catch (error) {
    loadingState.hidden = true;
    accessState.hidden = true;
    library.hidden = false;
    transcriptList.innerHTML = `<div class="empty">${esc(error.message || "Unable to load transcripts.")}</div>`;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadTranscripts);
loadTranscripts();
