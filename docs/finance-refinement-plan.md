# Finance refinement plan and implementation record

## Phase 1 — audit findings

The existing project already had working Stripe balance/payout reads, supplier catalog and order integrations, Discord owner commands, Supabase order/key history, fulfillment cost records, and a finance-health report. Those systems remain the source of historical truth.

The gaps were a deterministic spendable-cash decision, explicit separation of Stripe available versus pending funds, persistent funding plans and reinvestment batches, FIFO attribution, safe simulation controls, and a serialized background worker. The new engine is intentionally separate from the historical supplier report so existing reporting semantics are preserved.

## Implemented refinement

- `finance/reinvestment-engine.mjs` contains pure calculations for sales velocity, demand state, reserve, runway, confidence, supplier allocation, safe-to-reinvest, funding plans, batches, FIFO order attribution, and refunds.
- `supabase-finance-reinvestment.sql` adds settings, supplier and Coinbase snapshots, sync runs, funding plans, reinvestment batches, order allocations, and audit events. RLS is enabled and public table access is revoked.
- The production server runs a serialized five-minute worker. It records read-only snapshots and approval-gated funding plans. Auto Mode remains off; a plan must carry explicit owner approval and per-plan live authorization before the Windows bridge can submit anything.
- The admin Supplier Report now shows settled Stripe cash, pending Stripe cash, CheatsLove balance, reserve, burn, runway, confidence, safety blocks, and recent plans.
- Owner Discord commands `/finance-safe`, `/finance-pause`, and `/finance-resume` provide private controls. `/finance-health` remains available for the existing reconciliation view.
- Production uses `FINANCE_REINVESTMENT_MODE=approval`, primary supplier CheatsLove at 100%, and finance Discord notifications disabled. `COINBASE_SEND_ENABLED` and `FINANCE_LIVE_EXECUTION_ENABLED` are explicit gates; they do not authorize a transfer by themselves.
- Phase 2 adds a simulation-safe Cheats.Love browser state machine (`finance/cheatslove-workflow.mjs`). It uses accessibility selectors, reads balance/top-up/USDC invoice details when a configured authenticated session is available, and stops before payment submission or on CAPTCHA/2FA/security challenges.
- Worker cycles now persist actual FIFO allocations from Cheats.Love order costs. A single order can span batches; revenue and refunds are allocated proportionally and batch return is persisted. Optional `CHEATSLOVE_TRANSACTIONS_PATH` rows are marked verified; balance-delta deposits are marked inferred with their formula.
- Owner commands include `/finance-status`, `/finance-cheatslove`, `/finance-stripe`, `/finance-profit`, `/finance-batches`, `/finance-last-reinvest`, `/finance-mode`, `/finance-pause`, and `/finance-resume`. `/api/admin/finance/propose-real` creates a fresh invoice-bound approval plan only when the explicit execution gates are enabled; a changed amount, confidence, balance, or invoice invalidates it. The Windows bridge reuses that exact invoice and never creates a second one during preparation.
- `finance/coinbase-browser-operator.mjs` performs the deterministic Coinbase browser flow through the persistent profile, verifies the final review values, stops on security challenges, and records `RECONCILIATION_REQUIRED` rather than retrying after an uncertain Send click. The dry-run path has been verified through review without clicking Send.
- The finance automation tool adapter only returns values from deterministic readers. The current runtime exposes Groq/Gemini identifiers, not GPT-5.6 Luna, so the requested model is reported as unavailable rather than silently substituted.

## Safety rules

Pending Stripe funds are never included in `safeToReinvestCents`. A missing or stale required source, failed reconciliation, unknown CheatsLove balance, insufficient confidence, or paused automation produces a zero eligible amount. Coinbase transfers require a fresh available-to-send snapshot, an unexpired invoice, a matching final review, atomic bridge claim, and owner approval for the same funding plan. CheatsLove authentication is still required before a fresh real invoice can be prepared; no real invoice or transfer is created when that session is unavailable.

## Verification

Run:

```bash
npm run finance:test
npm run finance:workflow:test
npm run finance:workflow:simulate
npm run build
npm run discord:check:static
node --check server.js
```

The finance test suite covers pending-fund exclusion, stale-data blocking, zero-burn runway, demand spikes, FIFO batches, split-cost attribution, refunds, and simulation batch creation.
