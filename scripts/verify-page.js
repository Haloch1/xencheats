import { initReveal } from "./site.js";

initReveal();

const statusBox = document.getElementById("verifyStatus");
const heading = document.getElementById("verifyHeading");
const subtext = document.getElementById("verifySubtext");
const continueLink = document.getElementById("verifyContinueLink");

const CONTINUE_URL = "/api/auth/discord?mode=verify";
const COOKIE_NAME = "xc_verify_fp";
const verifyError = new URLSearchParams(window.location.search).get("error");

function setStatus(message, tone = "info") {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `inline-message ${tone}`;
}

/* ── Lightweight device fingerprint ──
   None of this is unique enough on its own to identify a person - the point
   is combining several weak signals into one hash that stays stable across
   IP/VPN changes on the same physical device, so switching networks alone
   doesn't let someone dodge a ban. This never touches personal data (no
   names, no exact location) - just rendering/hardware characteristics. */

function getCanvasSignature() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 90, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("XenCheats fp 0123", 2, 15);
    ctx.fillStyle = "rgba(102, 200, 0, 0.6)";
    ctx.fillText("XenCheats fp 0123", 4, 30);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

function getWebglSignature() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}::${renderer}`;
  } catch {
    return "";
  }
}

function getFontSignature() {
  try {
    const testString = "mmmmmmmmmmlli";
    const testSize = "72px";
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const candidateFonts = [
      "Arial", "Arial Black", "Calibri", "Cambria", "Comic Sans MS", "Consolas",
      "Courier New", "Georgia", "Helvetica", "Impact", "Segoe UI", "Tahoma",
      "Times New Roman", "Trebuchet MS", "Verdana",
    ];
    const span = document.createElement("span");
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.fontSize = testSize;
    span.textContent = testString;
    document.body.appendChild(span);

    const baseSizes = {};
    baseFonts.forEach((base) => {
      span.style.fontFamily = base;
      baseSizes[base] = `${span.offsetWidth}x${span.offsetHeight}`;
    });

    const detected = candidateFonts.filter((font) =>
      baseFonts.some((base) => {
        span.style.fontFamily = `'${font}', ${base}`;
        return `${span.offsetWidth}x${span.offsetHeight}` !== baseSizes[base];
      })
    );

    document.body.removeChild(span);
    return detected.join(",");
  } catch {
    return "";
  }
}

function getHardwareSignature() {
  const nav = navigator;
  return [
    nav.hardwareConcurrency || "",
    nav.deviceMemory || "",
    nav.platform || "",
    nav.maxTouchPoints || 0,
    screen.width,
    screen.height,
    screen.colorDepth,
    window.devicePixelRatio || 1,
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    nav.language || "",
    (nav.languages || []).join(","),
  ].join("|");
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildFingerprint() {
  const parts = [
    getCanvasSignature(),
    getWebglSignature(),
    getFontSignature(),
    getHardwareSignature(),
  ];
  return sha256Hex(parts.join("::"));
}

function setFingerprintCookie(hash) {
  const isSecure = window.location.protocol === "https:";
  document.cookie = [
    `${COOKIE_NAME}=${hash}`,
    "path=/",
    "max-age=300",
    "samesite=lax",
    isSecure ? "secure" : "",
  ].filter(Boolean).join("; ");
}

function goToDiscord() {
  window.location.href = CONTINUE_URL;
}

async function run() {
  if (verifyError) {
    const configurationError = verifyError === "oauth_configuration";
    const emailRequired = verifyError === "email_required";
    const oauthUnavailable = verifyError === "oauth_unavailable";
    if (heading) {
      heading.textContent = emailRequired
        ? "Verified Discord email required"
        : "Verification temporarily unavailable";
    }
    if (subtext) {
      subtext.textContent = emailRequired
        ? "Add and verify an email address on your Discord account, then try again."
        : configurationError
          ? "Discord verification needs administrator attention. Please try again later."
          : oauthUnavailable
            ? "Discord did not complete the authorization request. Please wait a moment and try again."
            : "The Discord bot or account service could not finish verification. Please wait a moment and try again.";
    }
    setStatus(
      emailRequired
        ? "Discord did not provide a verified email address."
        : configurationError
        ? "Verification is not configured correctly right now."
        : "Verification is temporarily offline. Server access was not granted.",
      "error",
    );
    if (continueLink) {
      continueLink.hidden = false;
      continueLink.textContent = "Try again";
    }
    return;
  }

  // If fingerprinting hangs for any reason, let the user through manually
  // rather than trapping them on this page - a missing fingerprint just
  // means one fewer signal, it never blocks verification by itself.
  const fallbackTimer = setTimeout(() => {
    setStatus("Taking longer than expected. You can continue manually below.", "info");
    if (continueLink) continueLink.hidden = false;
  }, 4000);

  try {
    const hash = await buildFingerprint();
    if (hash) setFingerprintCookie(hash);
    clearTimeout(fallbackTimer);
    setStatus("Redirecting to Discord...", "success");
    if (heading) heading.textContent = "Redirecting...";
    if (subtext) subtext.textContent = "Sending you to Discord to finish verification.";
    setTimeout(goToDiscord, 250);
  } catch {
    clearTimeout(fallbackTimer);
    setStatus("Continuing without device check.", "info");
    setTimeout(goToDiscord, 250);
  }
}

run();
