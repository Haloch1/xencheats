# XenCheats storefront

The project contains the storefront, Discord bot, admin panel, supplier integrations, and Supabase-backed order history.

## Development

```bash
npm install
npm run build
npm run finance:test
npm run discord:check:static
```

Copy `.env.example` to `.env` for local development. Never commit provider keys, Stripe secrets, Discord tokens, or Supabase service-role credentials.

## Finance worker

The finance refinement starts in **simulation mode**. The server worker reads Stripe and supplier balances, calculates a deterministic safe-to-reinvest amount, and stores funding plans and audit rows in Supabase. It does not transfer money. Pending Stripe funds are always excluded. The owner can review the state in the Admin Supplier Report or use `/finance-safe`; `/finance-pause` and `/finance-resume` control the worker’s eligibility without deleting history.

See [`docs/finance-refinement-plan.md`](docs/finance-refinement-plan.md) for the audit record, schema, safety rules, and verification commands.

The conversational layer remains independent from the finance worker. Configure `AUTOMATION_CHAT_MODEL`, `AUTOMATION_CHAT_REASONING_EFFORT`, and `AUTOMATION_CHAT_FALLBACK_MODEL` only when those model identifiers are available in the deployed runtime; otherwise the configured existing support provider continues unchanged and financial calculations remain deterministic.
