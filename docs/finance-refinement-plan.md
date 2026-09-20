# Finance refinement plan and implementation record

## Phase 1 — audit findings

The existing project already had working Stripe balance/payout reads, supplier catalog and order integrations, Discord owner commands, Supabase order/key history, fulfillment cost records, and a finance-health report. Those systems remain the source of historical truth.

The gaps were a deterministic spendable-cash decision, explicit separation of Stripe available versus pending funds, persistent funding plans and reinvestment batches, FIFO attribution, safe simulation controls, and a serialized background worker. The new engine is intentionally separate from the historical supplier report so existing reporting semantics are preserved.

## Implemented refinement

- `finance/reinvestment-engine.mjs` contains pure calculations for sales velocity, demand state, reserve, runway, confidence, supplier allocation, safe-to-reinvest, funding plans, batches, FIFO order attribution, and refunds.
- `supabase-finance-reinvestment.sql` adds settings, supplier and Coinbase snapshots, sync runs, funding plans, reinvestment batches, order allocations, and audit events. RLS is enabled and public table access is revoked.
- The production server runs a serialized five-minute worker. It records read-only snapshots and simulation plans. It never moves money in simulation mode.
- The admin Supplier Report now shows settled Stripe cash, pending Stripe cash, CheatsLove balance, reserve, burn, runway, confidence, safety blocks, and recent plans.
- Owner Discord commands `/finance-safe`, `/finance-pause`, and `/finance-resume` provide private controls. `/finance-health` remains available for the existing reconciliation view.
- The default production configuration is `FINANCE_REINVESTMENT_MODE=simulation`, primary supplier CheatsLove at 100%, and finance Discord notifications disabled.

## Safety rules

Pending Stripe funds are never included in `safeToReinvestCents`. A missing or stale required source, failed reconciliation, unknown CheatsLove balance, insufficient confidence, or paused automation produces a zero eligible amount. Live supplier deposits and Coinbase transfers are not implemented or called by this simulation worker. A future approval/auto mode must be enabled deliberately after official provider credentials, limits, payout timing, and reconciliation rules are reviewed.

## Verification

Run:

```bash
npm run finance:test
npm run build
npm run discord:check:static
node --check server.js
```

The finance test suite covers pending-fund exclusion, stale-data blocking, zero-burn runway, demand spikes, FIFO batches, split-cost attribution, refunds, and simulation batch creation.
