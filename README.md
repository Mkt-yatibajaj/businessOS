# Advaitum Business OS

Private inventory, purchasing, sales and profit tracker. Next.js 15 + Supabase (Auth, Postgres, RLS) on Vercel.

## What it does
- **Products** (SKU, category, reorder level, activate/deactivate) and **Stock** levels with low/out-of-stock alerts
- **Purchases**: multi-product, supplier, invoice no., freight/extra cost spread across lines into landed cost; cancel (admin)
- **Sales**: multi-product, any channel, discount, platform fees, shipping; FIFO costing; oversell blocked; cancel restores exact lots (admin)
- **Stock adjustments** (damage, loss, correction, opening stock) with mandatory reason + full movement log
- **Expenses** (ads, rent, packaging, salaries…) with void
- **Reports** for any date range: P&L (net profit), by channel, by product, daily trend; CSV export of everything
- **Team**: owner assigns roles (viewer / operator / admin / owner) + activity log
- Auto numbering (SAL-1001, PUR-1001) or type your own order IDs

## Setup (15 minutes) - see docs/DEPLOYMENT.md
1. Supabase: new project → SQL Editor → run `supabase/migrations/0001_advaitum_core.sql`, then `0002_operations.sql`.
2. Authentication → Users → Add user (your email + password). Run `supabase/bootstrap-owner.sql` with your email.
3. Vercel: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, redeploy.

## Commands
`npm install` · `npm run dev` · `npm run typecheck` · `npm run lint` · `npm run build`

Never put a Supabase service-role/secret key in this app or in any `NEXT_PUBLIC_` variable.
