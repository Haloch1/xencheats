# XenCheats Operations Setup

## Discord bot

The customer/support bot runs inside the main `xencheats` web service. The
separate `discord-bot/` worker is only the optional channel-mirror process; it
does not provide tickets, verification, customer roles, or slash commands.
Validate that worker's JSON/channel mapping independently with
`npm --prefix discord-bot run check`.

Run the offline command/handler audit before every deploy:

```powershell
npm run discord:check:static
```

With the real environment loaded, run the full Discord API, intents,
permissions, role hierarchy, channel, and registered-command audit:

```powershell
npm run discord:check
```

`/api/health` reports the web process and Discord gateway separately. Keep the
HTTP response healthy so Render does not restart the storefront solely because
Discord is unavailable; use the nested Discord `state`, `ready`, and `commands`
fields for alerts. `/api/status` exposes the same outage as maintenance without
publishing credentials or internal error text.

If the full check reports HTTP 401, reset the token in Discord Developer Portal,
replace `DISCORD_BOT_TOKEN` in Render, and redeploy. Never paste or commit the
token. Enable both **Server Members Intent** and **Message Content Intent**. The
bot role must remain above every role it assigns and retain the permissions
listed by `npm run discord:check`.

Discord OAuth refresh tokens are stored as AES-256-GCM ciphertext. Set a stable
random `DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY` in Render; existing deployments can
temporarily fall back to `DISCORD_CLIENT_SECRET`. Rotating that encryption key
invalidates older stored refresh tokens, so members would need to relink their
Discord account before `/reinvite-all` can act for them again.

Discord AI is enabled by default when both `DISCORD_AI_RUNTIME_ENABLED` and
`DISCORD_AI_SUPPORT_ENABLED` are true. During an incident, set either flag to
false to route support directly to staff. The `/togglebot` command and
per-channel mute list remain available for narrower controls.

## Backups

Supabase's managed backups are the primary recovery layer. In Supabase, enable daily
backups/PITR on a plan that supports it. For an independent copy, install PostgreSQL
tools on a secure machine and run:

```powershell
$env:SUPABASE_DB_URL = "postgresql://..."
node scripts/backup-supabase.mjs
```

Copy each generated `.dump` file to private offsite storage (for example R2, S3, or an
encrypted drive). Render's filesystem is ephemeral, so do not treat a Render disk as a
backup destination. Test a restore in a separate Supabase project before relying on it.

## Error Monitoring

Set `DISCORD_ERROR_CHANNEL_ID=1530317219337076837` in Render. The server reports
unhandled failures there, with repeated identical failures limited to one alert every
five minutes. It redacts long token-like strings before posting.

## Google Sign-in

1. In Google Cloud Console, create or select a project and enable the Google OAuth
   consent screen as **External**. Use `XenCheats` as the app name.
2. Add `xencheats.wtf` as an authorized domain and add yourself as a test user while
   the consent screen remains in testing.
3. Create an OAuth client of type **Web application**. Add this exact redirect URI:
   `https://xencheats.wtf/api/auth/google/callback`.
4. In Render, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and verify
   `PUBLIC_SITE_URL` and `BASE_URL` are both `https://xencheats.wtf`.
5. Redeploy, then test in a private browser window. Once public users need access,
   publish the consent screen. This project only requests `openid`, `email`, and
   `profile`; do not add sensitive scopes unless they are genuinely needed.

## Apple Sign-in

Apple requires an Apple Developer membership. Create a Services ID for the website,
add `https://xencheats.wtf/api/auth/apple/callback` as its return URL, then generate a
Sign in with Apple key. Store its values only in Render as `APPLE_CLIENT_ID`,
`APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY`. Do not enable an Apple button
until the callback route is deployed and tested.

## Admin 2FA

Use app-based TOTP rather than emailed codes. Generate an encryption key with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store it as `ADMIN_TOTP_ENCRYPTION_KEY` in Render. Set `ADMIN_TOTP_REQUIRED=true` only
after the admin 2FA migration and enrollment flow are deployed; otherwise admins could
be locked out. Never put this key in Git or Discord.
