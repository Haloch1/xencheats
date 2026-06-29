/**
 * One-time script to get a YouTube OAuth2 refresh token.
 * Run locally: node scripts/youtube-auth.mjs
 *
 * It will open a browser window for you to sign in with your YouTube account.
 * After granting access, paste the code back here to get your refresh token.
 * Save the refresh token as YOUTUBE_REFRESH_TOKEN env var in Render.
 */

import { google } from "googleapis";
import http from "http";
import { URL } from "url";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars before running this script.");
  console.error("Example: YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy node scripts/youtube-auth.mjs");
  process.exit(1);
}
const REDIRECT_URI = "http://localhost:3333/callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
});

console.log("\n=== YouTube OAuth Setup ===\n");
console.log("Opening browser for authorization...\n");

// Start a tiny local server to catch the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3333`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("No code received.");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n=== SUCCESS ===\n");
    console.log("Refresh Token (save this as YOUTUBE_REFRESH_TOKEN in Render):\n");
    console.log(tokens.refresh_token);
    console.log("\n===============\n");

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Done! You can close this tab.</h1><p>Go back to your terminal and copy the refresh token.</p>");
  } catch (err) {
    console.error("Error getting token:", err.message);
    res.writeHead(500);
    res.end("Error: " + err.message);
  }

  setTimeout(() => {
    server.close();
    process.exit(0);
  }, 1000);
});

server.listen(3333, () => {
  console.log("Waiting for callback on http://localhost:3333/callback ...\n");

  // Try to open browser automatically
  const openCmd =
    process.platform === "win32" ? "start" :
    process.platform === "darwin" ? "open" : "xdg-open";

  import("child_process").then(({ exec }) => {
    exec(`${openCmd} "${authUrl}"`);
  });
});
