# Advaitum Business OS — Supabase-connected MVP

Private Next.js 15 + Supabase application for product master, purchase lots, FIFO sales posting and inventory reporting.

## Important status
This is a functional source implementation, not a certified production ERP. The source package has not been tested against your live Supabase project. It currently supports **one SKU per purchase and one SKU per sale**. Multi-line invoices, returns, cancellation workflows, stock adjustments, supplier CRUD, expenses, multi-user invitation UI, and full date-filtered P&L are not implemented. Do not import live business records until the deployment and transaction test plan passes.

## Stack
- Next.js 15 / React 19 / TypeScript
- Supabase Auth, Postgres, RLS, SQL RPCs
- Vercel deployment

## Quick start
1. Create a Supabase project.
2. Run `supabase/migrations/0001_advaitum_core.sql` in SQL Editor on a **new empty project**.
3. In Authentication → Users, create your own account. Public sign-up is not provided in the app.
4. Replace the email in `supabase/bootstrap-owner.sql` and run it. Verify your profile role is `owner`.
5. Copy `.env.example` to `.env.local`, fill the Project URL and publishable key.
6. Run `npm install`, `npm run dev`.
7. Deploy the repository to Vercel and set the same two environment variables for Production, Preview and Development; redeploy.

## Security notes
- Never use the Supabase service-role or secret key in this application or any `NEXT_PUBLIC_` variable.
- Authenticated users require a `profiles` row. New auth users receive `viewer` by trigger.
- RLS protects all business tables. Purchase and sales ledger tables are read-only to the client; only transaction RPCs post them.
- The owner bootstrap SQL is a one-time administrative operation. Keep access to Supabase SQL Editor restricted.
- This is currently a single-workspace app; role separation exists in SQL but there is no user-management screen.

## Documentation
- `docs/DEPLOYMENT.md`
- `docs/FEATURES_AND_LIMITATIONS.md`
- `docs/SECURITY.md`
- `docs/TEST_PLAN.md`

## Commands
`npm run dev` — local development
`npm run typecheck` — TypeScript check
`npm run lint` — ESLint
`npm run build` — production build
