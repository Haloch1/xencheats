# Nox Cheats (formerly Halo Cheats) - Project Context

## What This Is

Digital storefront selling license keys for game mods (R6, Fortnite, Rust, Apex, EFT, Spoofers, Accounts) at **halocheats.cc** (rebranded to **Nox Cheats** in July 2026). Owner: Azad.

## Stack

- **Backend:** Express 5, single `server.js` (~10-11k lines), Node 22
- **Frontend:** Vite 7, vanilla JS, multi-page HTML
- **Auth:** Supabase Auth (email/password + Discord OAuth + Google OAuth planned)
- **Database:** Supabase Postgres
- **Payments:** Stripe checkout + webhook auto-fulfillment, NOWPayments (crypto)
- **Bot:** Discord.js integrated into server.js, 36+ slash commands
- **Deploy:** Render, auto-deploys on push to GitHub

## Repos & Deployments

| Site | Repo | Branch | Render Service | Supabase |
|------|------|--------|---------------|----------|
| **halocheats.cc** (production) | `Haloch1/Halocheats` | `master` | `halo-cheats` | `zeqdjbyhqnspxudbvypr` |
| **beta.halocheats.cc** (standalone/friend) | `Haloch1/NoxCheats` | `main` | `NoxCheats` | `yuzkecganrbpkceubmbr` |

Rollback branch for pre-rebrand site: `backup-live-halo-2026-07-13`

## Key Systems

- **Product catalog** in `data/products.js` — variant-level pricing tied to Stripe price IDs, stock tracked in Supabase `license_keys` table
- **Checkout flow:** Stripe session -> webhook -> `fulfillOrder` assigns first unused license key
- **Balance/wallet:** `user_balances` + `balance_transactions` tables, Postgres functions `credit_balance`/`spend_balance` (SECURITY DEFINER, service_role only). Card top-ups via Stripe, crypto via NOWPayments
- **Cart:** localStorage `hc_cart`, pay-with-balance or Stripe
- **Auth:** Cookie-based (HttpOnly access+refresh tokens), server-side session API
- **Live desk:** `support_threads` + `support_messages` tables, Discord notifications. Two-way: web tickets open Discord threads, staff Discord replies sync back
- **Admin panel:** Multi-layer security — admin key -> Supabase auth -> staff access request (owner-approved) -> audit logging
- **Owner panel:** Staff access management, user directory, visitor analytics
- **Reseller API:** Bearer token auth for programmatic key purchases
- **Upload bot:** `/upload` slash command posts videos to 7 platforms (YouTube, Bluesky, X, Instagram, Facebook, TikTok, Threads)
- **Dynamic admin system:** `bot_admins` Supabase table, /perms /grant /revoke slash commands
- **Kill-switch:** `bot_settings` table + middleware, /lockdown /online commands
- **Reviews:** Discord channel -> reviews table pipeline, AI moderation via Groq
- **Delete approval flow:** Staff requests one-time delete key -> owner provides via Discord -> staff confirms

## DB Tables

`orders`, `license_keys`, `support_threads`, `support_messages`, `admin_access_requests`, `admin_audit_logs`, `admin_delete_approvals`, `user_balances`, `balance_transactions`, `bot_admins`, `bot_settings`, `reviews`, `tickets`, `ticket_messages` (plus Supabase `auth.users`)

## Security Model

- Roles in `app_metadata.role` (NOT user_metadata — that's user-editable)
- `discord_id` stored in `app_metadata`, read via `discordIdOf()` helper
- RLS enabled on all public tables (server uses service role)
- Per-user slash-command cooldowns, rate limits on search/promo
- Ticket creation cooldowns
- Unique partial index prevents double key assignment per order
- Promo codes exist in TWO places: `scripts/products-page.js` (frontend) and `server.js` (server-side validation)

## Project History (13 Phases)

1. **Halo Cheats on Codex** (pre-June 2026) — Built the full storefront, 79+ commits
2. **Migration to Cowork** (late June 2026) — Moved dev environment
3. **Security Hardening** (July 2-3) — app_metadata roles, RLS, cooldowns, rate limits
4. **Balance/Wallet System** (July 7) — Store credit with Stripe/crypto top-ups
5. **Git Identity Scrub** (July 7) — Purged personal identity, all commits as Haloch1
6. **Upload Bot** (late June/early July) — 7-platform video upload via Discord
7. **Nox Rebrand Design** (July 12) — New design, same backend/catalog
8. **Nox Standalone for Friend** (July 13) — Full-stack copy with own Supabase
9. **Discord Desk Integration** (July 13) — Two-way ticket threading
10. **Nox Live on halocheats.cc** (July 13) — Rebrand deployed to production
11. **Standalone Deploy + Redesign** (mid-July) — beta.halocheats.cc, light theme redesign
12. **Live Bot Hardening** (July 16) — Dynamic admins, kill-switch, safety-net
13. **NoxCheats Blue** (July 2026) — Separate Lovable project (TanStack+React), blue/white premium design

## Rules

- **Public repo** — all secrets must be env vars only, never hardcode anything
- **Git author:** always `Haloch1 <Haloch1@users.noreply.github.com>`
- **Always commit+push** after code changes so Render auto-deploys
- **Never touch payments/checkout/Stripe/backend** during visual/design work
- **After every edit**, summarize what changed and list the files touched
- **Verify live deploy** before editing frontend — check what's actually serving, don't blindly tweak CSS
- **Build:** `npm run build` (Vite), `npm start` (Express serves dist/)
- **Dev:** `npm run dev` (Express :4242 + Vite :3000 with proxy)

## Open Items

- Google OAuth: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` need to be set in Render + Google Cloud Console
- `DISCORD_SUPPORT_CHANNEL_ID` + `DISCORD_ORDER_WEBHOOK_URL` need setting for live desk/order Discord mirroring
- CSP `unsafe-inline` for styles not yet removed
- Static owner-cookie hash not yet replaced with random server sessions
- Git history still contains old key inventory PDF (purge recommended)

## NoxCheats Blue (Separate Project)

Lovable project at `Downloads/NoxCheats Blue`. TanStack Start + React + Vite + Supabase + Stripe. Light blue/white design (glassy nav, Sora font, aurora background). Goal: premium-up all pages to homepage quality. Visual only, no backend changes.
