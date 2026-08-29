# XenCheats — Claude Project Instructions

This file is the current source of truth for Claude. Read it completely before
editing the project, then read `docs/CLAUDE-HANDOFF.md` for the detailed session
memory and current work state.

`CODEX-CONTEXT.md` is historical and substantially outdated. It describes an
older Halo/Nox deployment and must not override this file or the handoff.

## Project and deployment

- Product: XenCheats storefront and Discord operations bot for `xencheats.wtf`.
- Repository: `https://github.com/Haloch1/xencheats.git`.
- Active branch: `main`.
- Deployment: Render automatically deploys pushes to `main`.
- Backend and Discord bot: Express/Discord.js in the large `server.js` file.
- Frontend: Vite multi-page vanilla JavaScript.
- Catalog: `data/products.js`; storefront behavior: `scripts/products-page.js`.
- Database/auth: Supabase; payments: Stripe; supplier fulfillment: Cheats.Love,
  RFT, and Ghostware.

## Non-negotiable workflow

1. Start with `git status --short --branch`. Preserve unrelated user changes.
2. Search with `rg` and inspect the existing path before changing behavior.
3. Make narrow edits; do not rewrite large files or remove unrelated behavior.
4. Never place credentials, API keys, customer data, exact license keys, or
   cookies in source, logs, commits, screenshots, or handoff documents.
5. Verify proportional to the change. Minimum checks for server/catalog work:
   `node --check server.js`, `git diff --check`, and `npm run build`.
6. For Discord work, also run `npm run discord:check:static`. Two historical
   failures may still exist: AI-dependent review rating and the cross-channel
   spam-listener check. Do not claim these are caused by a new change without
   comparing the baseline.
7. After a requested code change, commit only files changed for that request and
   push `main` so Render deploys. Never stage unrelated dirty files.
8. Report the commit hash, verification performed, and any remaining issue.

The known unrelated worktree state at this handoff is:

- `.vscode/tasks.json` is deleted by the user.
- `discord-bot/discord-bot-code.js` is untracked user work.

Do not restore, delete, stage, or commit either unless the user explicitly asks.

## Public storefront rules

- Never expose supplier names or supplier-specific wording publicly. This
  includes product names, descriptions, feature lists, instructions, status
  text, API errors, HTML, and client-side data.
- Product names should be concise and professional. Do not repeat the game name
  in a product name (for example, use `Ancient`, not `Fortnite Ancient`, inside
  the Fortnite category).
- Do not invent generic feature lists or setup instructions. Use verified,
  product-specific supplier/reseller material where the store is licensed to
  reuse it. Preserve relevant links/content, but do not add vague boilerplate.
- Never display `Testing` or `stock check pending`. Use the real product status;
  if availability cannot be confirmed, show `Unavailable`.
- Avoid whole-dollar-looking retail prices where the established catalog uses
  one-cent-under pricing. Do not globally reprice products without comparing
  current supplier cost, existing margin, and prior retail ratios.
- Category order is defined in `scripts/products-page.js` and currently starts:
  Rainbow Six Siege, Fortnite, Rust, Counter-Strike 2, Apex Legends, Accounts,
  Spoofer, Call of Duty, Escape from Tarkov, Valorant, Minecraft, GTA V, Rocket
  League; remaining categories follow afterward.
- Category artwork already contains its category title. The UI intentionally
  avoids repeating that title over the image. Product count/status badges live
  at the top right, pictures use a light overlay, and category badges should
  not contain stray punctuation.
- Crusader R6S is the highlighted/most-bought product/bundle anchor.
- Boosting is excluded from the public catalog.

## Supplier routing and API rules

- Suppliers are separate systems and credentials must never be mixed.
- Cheats.Love uses `CHEATSLOVE_API_KEY` and the shared `cheatsloveFetch()` queue.
  Never bypass that queue. The code deliberately stays below the provider's
  ceiling and backs off for at least 60 seconds after a 429.
- RFT uses `RFT_SELLER_API_KEY` (legacy RFT variables remain only for deployment
  compatibility). RFT is not a generic fallback route. A product uses RFT only
  when its route is deliberately mapped to RFT.
- Ghostware uses `SELLAUTH_RESELLER_API_KEY`; it is a separate SellAuth-backed
  supplier and must not receive the RFT credential.
- Aptitude, Exodus Lite, and Exodus are Ghostware products. Their duration
  aliases are mapped in the catalog/server and must remain mapped to Ghostware.
- Unlock All is intentionally routed to RFT because it was cheaper there.
- When a product has multiple intentionally configured routes, choose the
  cheapest confirmed in-stock route first. Do not silently invent a route or
  use RFT as a universal fallback.
- Supplier APIs must be rate-limited and cached. Catalog pages should not wait
  on a large number of per-product stock calls.
- Public errors must fail closed to `Unavailable` and must not identify the
  supplier.

## Finance/accounting rules

- Cash product sales are revenue. Customer wallet/balance top-ups are not
  supplier revenue; they create a customer balance liability.
- Purchases paid from customer balance are fulfillment activity, not new cash
  revenue. Their supplier cost is tracked separately.
- Media/free keys are not revenue. Their retail value and actual supplier cost
  are shown separately and reduce the adjusted result.
- Reinvestments/supplier deposits are transfers, not losses and not revenue.
  Supplier cost is recognized when a key/order is fulfilled.
- Never show a missing supplier/media cost as `$0.00`. Show `Unknown` or
  `Unavailable until costs are confirmed`. A true zero is shown only when no
  activity occurred or a zero cost is genuinely confirmed.
- `/supplier-report` is owner-only and view-only. It supports 1–90 days, shows
  each supplier plus daily revenue lines, and does not log a report merely
  because it was viewed.
- The supplier report's `Amount to reinvest (before fees)`:
  - replaces all confirmed supplier costs for cash, balance, and media orders;
  - reserves a fixed `$5.00` per generated report (not per day);
  - reinvests 60% of confirmed profit after that reserve;
  - includes the `$5.00` reserve in the displayed gross amount;
  - becomes unavailable if any required supplier cost is unconfirmed.
- `/finance-health` and the scheduled finance alert are intentionally written in
  simple language: last-24-hour sales/costs/fees/profit, Stripe payout status,
  supplier balances, customer money owed, reinvestments, needs-attention, and
  next action.
- Finance monitoring posts to Discord channel `1543064888903999548` and runs on
  the existing schedule. Regular checks should not ping the owner.
- The owner treats payout delay as the main operating constraint. Do not label a
  pending Stripe payout as a loss.

## Discord, permissions, and audit rules

- Exact delivered keys and owner audit information go to the private key-log
  channel `1542361007899418714`. Public/customer messages must not expose keys.
- Media key claims are logged to the private key feed, but they must not DM or
  ping the owner merely for a normal claim.
- Media users with the configured Media role can claim allowed media keys;
  owner-only inventory commands remain owner-only unless the implementation has
  a dedicated media path.
- Uploaded video files count as media activity, as do accepted TikTok video/LIVE
  links under the media tracking rules.
- Daily media reports, ticket reminders, stock pings, and similar scheduled
  tasks must persist their checkpoint and must not fire again merely because
  Render redeployed.
- Ticket waiting-for-reply analysis reads recent messages, runs every 12 hours,
  and should not reset on deploy.
- `/getkey`, `/usekey`, `/dhyperv`, `/createcode`, finance commands, and other
  destructive/sensitive controls have explicit role checks. Never rely only on
  Discord's command visibility; keep runtime authorization.
- Staff anti-nuke protection applies to admins, employees, media managers,
  configured extra staff roles (`DISCORD_PROTECTED_STAFF_ROLE_IDS`), and anyone
  holding dangerous Discord permissions. The owner ID is exempt.
- Anti-nuke detection covers channel/role destruction, mass bans/kicks/prunes,
  permission escalation, bot/webhook activity, bulk/repeated message deletion,
  thread deletion, and webhook deletion. On threshold it removes dangerous
  roles where possible, times out/kicks according to configuration, attempts
  rollback, logs evidence, and alerts the owner/moderation channel.
- The bot role must remain above every staff role it may need to quarantine.
- `/dhyperv` distributes an owner-approved batch helper. The user explicitly
  requested that the attached batch file be treated as opaque: do not execute
  it or inspect its contents unless the user later gives explicit permission.

## Security and data handling

- This repository is public. Secrets belong only in Render/Supabase environment
  configuration. `.env.example` contains names/placeholders, never real values.
- A live RFT seller key appeared in a prior screenshot/chat. Treat it as exposed
  and recommend rotation; never reproduce it in text or source.
- Roles and Discord IDs that control authorization belong in trusted server-side
  configuration/app metadata. Never trust user-editable metadata.
- Preserve Supabase RLS and service-role-only writes for privileged tables.
- Never expose exact customer emails, payment identifiers, license keys, admin
  access keys, or supplier order credentials in normal Discord channels.

## Communication preferences

- The owner prefers direct, simple explanations with the result first.
- Avoid long theory. State what changed, what the number means, and what to do.
- Do not guess supplier data, features, instructions, stock, costs, or status.
- Verify first, then commit and push. If verification finds an unrelated
  pre-existing failure, distinguish it clearly from the requested change.

