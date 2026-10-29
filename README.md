# Advaitum Business OS — Starter

Responsive Next.js + TypeScript starter for Advaitum inventory, purchase-lot costing, sales and reporting.

**Status: UI demo only. Not production-ready.** The current UI uses in-memory sample records and is not connected to Supabase. The SQL migration is a starting schema; authentication, tested RLS policies, transaction-safe inventory posting and real reports still need implementation.

## Start locally
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Documentation
- `docs/LAUNCH_GUIDE.md` — full free launch walkthrough
- `docs/PRODUCTION_CHECKLIST.md` — go-live gate
- `docs/DATABASE_AND_REPORTS.md` — data model and calculation rules
- `docs/AI_CODING_PROMPT.md` — prompt for an AI coding agent
- `docs/TROUBLESHOOTING.md` — common setup and deployment errors
- `supabase/migrations/0001_initial_schema.sql` — starter schema only

## Recommended free path
GitHub Free (private repository) → Cloudflare Pages (static export) → Supabase Free (database/auth).

This path fits the current client-side starter. If server-only routes or secrets are added later, reassess the deployment design. Re-check current free-plan limits and terms.

## Security
Never commit `.env.local` or place Supabase service-role/secret keys in browser code. Do not use real business data until authentication, least-privilege RLS policies, transactional stock logic and backup/restore have been tested.
