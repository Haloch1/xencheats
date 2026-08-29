# XenCheats — Full Claude Handoff

Handoff date: **2026-08-29**
Repository: `Haloch1/xencheats`
Branch: `main`
Live project: `xencheats.wtf`

This document captures the working memory and decisions from the long Codex
session so Claude can continue without the original chat. Read `../CLAUDE.md`
first; its rules are authoritative.

## 1. Current repository state

At handoff, `main` is synchronized with `origin/main`. The newest commits are:

- `738e9ed` — Show unknown media costs accurately.
- `f0232ae` — Simplify finance health alerts.
- `3962969` — Keep reinvestment fee reserve fixed.
- `97b4410` — Extend anti-nuke protection to staff roles.
- `6ca37cc` — Show reinvestment target before fees.
- `a8ea21b` — Add supplier reinvestment guidance.
- `b873824` — Map Exodus Ghostware duration variants.
- `5c14a06` — Fix Ghostware products and balance fees.
- `3910102` — Add Crusader fixed-price promo.
- `8a46e68` — Add finance health and balance monitoring.
- `08d1b1a` — Refresh supplier costs before admin revenue.
- `13d5baa` — Align analytics with supplier accounting.
- `7544c5c` — Add all-supplier adjusted revenue summary.
- `186b014` — Separate balance and media activity from supplier revenue.
- `1fb4a38` — Route Aptitude and Exodus products through Ghostware.

Known unrelated dirty files belong to the user and must be preserved:

- deleted `.vscode/tasks.json`;
- untracked `discord-bot/discord-bot-code.js`.

The static catalog currently has approximately **101 products**, **321
variants**, and **19 categories**. Many Cheats.Love products intentionally omit
the simple `supplier` property because their exact route is resolved by the
Cheats.Love variation map; do not interpret every missing property as an
unmapped product.

## 2. What the owner is building

XenCheats is a game-software/license-key storefront with automatic checkout,
supplier fulfillment, live stock/status, product instructions, an owner/admin
panel, customer wallet balances, analytics, and an integrated Discord bot. The
owner wants the system to feel like one professional store: customers should
never see which supplier fulfilled an order.

The three supplier systems are:

- **Cheats.Love** — main/highest-volume supplier.
- **RFT** — separate native seller API; the owner wants to build its balance
  gradually and use it only for deliberately mapped products.
- **Ghostware** — SellAuth-backed supplier; lower sales volume, but the owner
  wants roughly `$30` available there.

The storefront also has account products. The owner recently found another
account source and planned a small `$10 total` pilot before scaling it.

## 3. Supplier decisions and catalog behavior

Current authoritative decisions:

- Do not add games merely because RFT lists them. The owner previously asked for
  additional games, then reversed that request. Add products mainly inside
  existing important categories unless the owner explicitly approves a game.
- RFT must not be a universal fallback. Explicit route mappings control it.
- When multiple intentional routes exist, prefer the cheaper confirmed in-stock
  route; a route with unknown cost or stock must not win.
- Unlock All uses RFT because it was cheaper there.
- Aptitude, Exodus Lite, and Exodus use Ghostware, including their duration
  aliases. They should not show `Coming Soon` solely because they are not
  Cheats.Love products.
- Crusader R6S remains prominent and has promo code `CRUSADER` with fixed retail
  prices before Stripe fee: 1 day `$2.99`, 7 days `$16.99`, 30 days `$29.99`.
- Prices generally follow the existing catalog ratios and one-cent-under style.
  Ancient/Crusader historically centered around a `$3.99`/`$4.00` 1-day retail
  point outside the fixed promo. Do not perform another broad price rewrite
  without checking current code, costs, and margins.
- Product status must be real. `Testing` and `stock check pending` were removed
  as public states; unknown availability is `Unavailable`.
- Feature lists and instructions must be product-specific and verified. The
  owner strongly rejected generic loader text such as “confirm your product,
  download the delivered loader, and follow its prompts.”
- Public text must say `No features listed` when none are available; it must not
  mention a supplier panel.
- Product links should lead to dedicated instructions for the exact item where
  those instructions exist.
- Public pages must contain no `RFT`, `Cheats.Love`, `Ghostware`, SellAuth, or
  other supplier identity.

Static supplier-related environment names:

- Cheats.Love: `CHEATSLOVE_API_KEY`, `CHEATSLOVE_BASE_URL`.
- RFT: `RFT_SELLER_API_KEY`, `RFT_API_BASE_URL`; legacy RFT names remain as
  compatibility fallbacks.
- Ghostware: `SELLAUTH_RESELLER_API_KEY`, `SELLAUTH_RESELLER_BASE_URL`.

Never exchange these credentials between integrations.

## 4. Catalog presentation and media assets

Preferred category order is defined in `scripts/products-page.js`:

1. Rainbow Six Siege
2. Fortnite
3. Rust
4. Counter-Strike 2
5. Apex Legends
6. Accounts
7. Spoofer
8. Call of Duty
9. Escape from Tarkov
10. Valorant
11. Minecraft
12. GTA V
13. Rocket League
14. Remaining categories in stable source order

Important presentation history:

- Category titles were removed from the image cards because the supplied art
  already contains the game name.
- Product counts/status badges are positioned at the upper-right of cards.
- Category-image dimming was reduced.
- Boosting products/categories are hidden.
- Product names should not repeat the category/game name.
- Crusader is represented as a most-bought bundle anchor with the NFA account.
- Product images live primarily in `assets/`, `assets/rft-media/`,
  `assets/categories/`, and are mapped by `scripts/products-page.js`.
- Category art was supplied for Minecraft, Rocket League, Valorant, GTA V, ARC
  Raiders, and Spoofers. Spoofer/product artwork also came from the local
  `toolkit-download-2026-08-28` folder and has already been copied into assets.

Do not depend on the original Downloads/OneDrive source paths during deploy;
the deployable copies in the repository are authoritative.

## 5. Checkout, balances, and fees

The system supports Stripe checkout and customer wallet/balance purchases.
Important accounting behavior:

- Stripe checkout fees are charged on top where configured.
- Customer balance top-ups include their Stripe fee as a separate line item;
  only the selected top-up amount is credited to the wallet.
- Customers cannot bypass Stripe processing cost by topping up balance.
- Wallet top-ups are not supplier revenue. Later wallet purchases are not new
  cash revenue.
- Accounts are currently intended to stay available unless their fulfillment
  balance/source cannot cover a purchase; the exact account integration may
  still require review if a new account supplier is introduced.

## 6. Supplier reporting and reinvestment

`/supplier-report` is owner-only, ephemeral/view-only, and accepts `days` from
1 to 90. It displays a separate embed for each supplier, plus per-day revenue
for multi-day reports.

Report rules:

- Revenue includes cash product sales only.
- Balance-funded purchases, customer top-ups, media/free keys, and supplier
  deposits are separate.
- Paid-but-unfulfilled Stripe orders can count as revenue only when Stripe
  confirms the payment. Unpaid/manual placeholders do not.
- Supplier cost uses the recorded fulfillment ledger first; fresh exact mapping
  is only a fallback for missing historical rows.
- Profit is unavailable when any required cost is unknown. Missing cost must
  never be displayed as zero.
- Funds added with `/invest` are transfers. `/uninvest` removes a mistaken
  ledger entry; `/investments` shows the ledger.
- Media/free-key retail value and actual supplier cost are both reported.

The reinvestment recommendation currently uses this logic:

```text
confirmed_costs = cash supplier cost + balance supplier cost + media supplier cost
fee_reserve = fixed $5.00 for the generated report
growth_profit = max(0, confirmed profit after all costs - fee_reserve)
amount_before_fees = confirmed_costs + 60% of growth_profit + fee_reserve
```

The displayed amount therefore includes the `$5` reserve. The owner should hold
that `$5` back rather than send it to the supplier. The reserve is fixed per
report and is not multiplied by the selected number of days.

## 7. Finance health monitor

Finance alerts go to channel `1543064888903999548`. The monitor snapshots
Stripe balances/payouts, known supplier balances, customer wallet liability,
fees, order costs, media costs, and reinvestments. Supplier balance increases
may be inferred and logged as investments; unexplained balance drops are
flagged after allowing for fulfilled-order costs.

The owner requested plain language. The current embed has:

- Last 24 hours: sales, supplier costs, Stripe fees, profit, media-key cost.
- Stripe payout: available, pending, and paid out.
- Supplier balances.
- Customer money: added, used, and still owed.
- Reinvestments.
- What this means.
- Needs attention.
- What to do.

Recent fix: if media claims exist but cost records are missing, the report says
`Unknown until costs are confirmed`. `$0.00 (none claimed)` is shown only when
there were no recent claims.

The owner asked the financial advice to assume payout delay is the main concern.
Do not call a pending payout a loss. Still preserve the accounting separation
between revenue, costs, customer liability, fees, and transfers.

Current personal allocation discussed for **`$180` pending Stripe funds split
across three payouts**, each with a `$5` payout fee:

- `$95` Cheats.Love
- `$45` RFT
- `$15` Ghostware
- `$10` account-supplier test
- `$15` total payout fees

Suggested payout-by-payout allocation:

- `$50`: `$20` Cheats.Love, `$15` Ghostware, `$10` accounts, `$5` fee.
- `$80`: `$45` Cheats.Love, `$30` RFT, `$5` fee.
- `$50`: `$30` Cheats.Love, `$15` RFT, `$5` fee.

This is planning context, not code or an automatic transfer instruction.

## 8. Discord media and key auditing

The Discord bot and web API are integrated in `server.js`.

Key/media decisions:

- Private exact-key audit channel: `1542361007899418714`.
- Every delivered/claimed key should be auditable with product, recipient/actor,
  delivery type, amount where applicable, supplier route internally, and order
  or campaign identifier.
- Normal key delivery/media claims must not ping or DM the owner.
- Suspicious order scans may alert in the private audit channel, but free/media
  claims and owner-retrieved keys must not be mistaken for fraudulent `$0`
  customer orders.
- Media employees with the proper Media role can claim through the media panel;
  owner-only `/getkey` remains a separate sensitive command.
- Uploaded video attachments count as media activity, not only links.
- Media role assignment should create/repair the member's private media channel.
- Daily media reminders/reports and restock pings must not repeat on every
  deployment.

TikTok LIVE follow-up: no implementation was added yet. Official TikTok data
portability can expose a host's completed Go LIVE history and duration. For
other creators, duration generally must be captured while live or submitted by
the creator. A future feature could add Start LIVE / End LIVE buttons to record
duration in the media system.

## 9. Discord security and staff permissions

The bot includes runtime role checks; command visibility is not considered
sufficient authorization.

Recent anti-nuke extension (`97b4410`):

- Monitors admins, employees, media managers, optional extra protected roles,
  and any member with dangerous permissions.
- Detects channel/role deletion, mass moderation, permission escalation,
  dangerous bot/webhook patterns, bulk/repeated message deletion, thread
  deletion, and webhook deletion.
- Mixed actions and rapid multi-target actions increase the risk score.
- At threshold, removes editable dangerous roles, quarantines/kicks according to
  settings, attempts reversible rollback, records evidence, and alerts the
  owner/moderation destinations.
- Owner ID is excluded from automatic containment.
- Bot hierarchy is required; if the bot role is below a staff role, Discord may
  prevent quarantine/rollback.

Relevant configuration is documented under the `DISCORD_STAFF_*` and
`DISCORD_PROTECTED_STAFF_ROLE_IDS` variables in `.env.example`.

## 10. Tickets, scheduled reports, and deployment persistence

- Ticket waiting-for-reply logic reads recent conversation context, avoids
  flagging resolved/acknowledgment messages, and checks on a 12-hour schedule.
- Ticket reminders/checkpoints, stock pings, media reports, finance alerts, and
  similar jobs should use persistent state so a Render restart does not replay
  them.
- Supplier reports are view-only when invoked manually. Scheduled daily reports
  remain separate.
- The bot should not ping the owner for normal key delivery or media claims.
- Finance alerts should ping only according to the established incident logic,
  not during every healthy scheduled run.

## 11. Instructions and `/dhyperv`

Product instructions are dedicated per product where source material exists.
Do not generate generic “download a loader and follow prompts” pages. Preserve
relevant installation links and product-specific details without naming the
supplier publicly.

The owner supplied `remove_hvix_hvax.bat` for `/dhyperv` and explicitly said not
to read it. Treat it as an opaque owner-provided attachment. Do not execute,
inspect, rewrite, or paste its contents without new explicit permission. The
public command copy should simply guide the user to switch to a local Windows
account, download the approved file, and run it as administrator.

## 12. Verification and known baseline issues

Normal verification commands:

```powershell
node --check server.js
node --check scripts/products-page.js
node --check data/products.js
npm run build
npm run discord:check:static
git diff --check
```

At the most recent session, syntax and Vite builds passed. The Discord static
checker historically reported two unrelated failures:

1. Review rating still depends on an AI provider.
2. Cross-channel spam guard does not synchronously block downstream listeners.

Re-run the checker before relying on this note; fix those only when requested or
when they overlap the active change.

## 13. Secrets and migration safety

Do not transfer the original chat's credentials to Claude. A live RFT key and
other sensitive values appeared in screenshots/pasted text. Only environment
variable names belong in the handoff. Rotate any key that was shown in chat or
screenshots, especially the RFT seller key.

Do not upload `.env`, screenshots containing credentials, raw customer order
screenshots, license-key logs, or pasted credential attachments to Claude.

## 14. Starter prompt for Claude

Use this after opening Claude Code in the repository, or after attaching this
repository and both handoff files to a Claude project:

> Continue the XenCheats project from the existing repository. First read
> `CLAUDE.md` and `docs/CLAUDE-HANDOFF.md` completely. Treat them as the current
> source of truth and treat `CODEX-CONTEXT.md` as outdated historical context.
> Inspect `git status` and preserve the user's unrelated deleted
> `.vscode/tasks.json` and untracked `discord-bot/discord-bot-code.js`. Never
> expose or commit credentials. For every requested code change, inspect the
> current implementation, make a narrow patch, run the relevant syntax/build
> checks, commit only the requested files, and push `main` for Render deploy.
> Keep explanations direct and simple. Do not guess supplier data or expose
> supplier identities publicly.

## 15. How the owner should continue in Claude

1. Rotate credentials that appeared in the old chat/screenshots.
2. Open Claude Code in a fresh clone of `Haloch1/xencheats`, or connect the
   GitHub repository to a Claude project.
3. Ensure the checkout is on `main` and pull the latest commits.
4. Confirm that `CLAUDE.md` and `docs/CLAUDE-HANDOFF.md` are present.
5. Paste the starter prompt above.
6. Describe only the next desired change; Claude should recover the remaining
   context from these files.
7. Keep production secrets in Render/Supabase, not in Claude project memory.
