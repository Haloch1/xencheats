# XenCheats storefront

The project contains the storefront, Discord bot, admin panel, supplier integrations, and Supabase-backed order history.

## Development

```bash
npm install
npm run build
npm run finance:test
npm run finance:workflow:test
npm run discord:check:static
```

Copy `.env.example` to `.env` for local development. Never commit provider keys, Stripe secrets, Discord tokens, or Supabase service-role credentials.

## Finance worker

The finance refinement starts in **simulation mode**. The server worker reads Stripe and supplier balances, calculates a deterministic safe-to-reinvest amount, stores FIFO reinvestment batches/allocations, and writes audit rows in Supabase. It does not transfer money. Pending Stripe funds are always excluded. The owner can review the state in the Admin Supplier Report or use `/finance-status`, `/finance-safe`, `/finance-profit`, and `/finance-batches`; `/finance-pause` and `/finance-resume` control the worker’s eligibility without deleting history.

The optional Cheats.Love browser workflow (`npm run finance:workflow:simulate`) reuses an authenticated Playwright session, uses accessible selectors, reads the top-up/USDC invoice details, and stops before payment submission. CAPTCHA, 2FA, and security challenges always stop the workflow. In a hosted worker, use the secret `CHEATSLOVE_STORAGE_STATE_JSON` (with `CHEATSLOVE_USERNAME`/`CHEATSLOVE_PASSWORD` only as a protected session fallback); do not commit either form. A simulated invoice must be at least $5 because that is the supplier's minimum. Live execution is disabled by `FINANCE_LIVE_EXECUTION_ENABLED=false`.

See [`docs/finance-refinement-plan.md`](docs/finance-refinement-plan.md) for the audit record, schema, safety rules, and verification commands.

The conversational layer remains independent from the finance worker. Configure `AUTOMATION_CHAT_MODEL`, `AUTOMATION_CHAT_REASONING_EFFORT`, and `AUTOMATION_CHAT_FALLBACK_MODEL` only when those model identifiers are available in the deployed runtime; otherwise the configured existing support provider continues unchanged and financial calculations remain deterministic.
