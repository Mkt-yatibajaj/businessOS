# Deployment guide

## 1. Supabase (database + login)
1. supabase.com → New project (choose a Mumbai/Singapore region; save the DB password).
2. **SQL Editor** → paste and run `supabase/migrations/0001_advaitum_core.sql`, then `0002_operations.sql` (in that order, once each, on a new project).
3. **Authentication → Users → Add user** → your email + strong password (tick auto-confirm).
4. **Authentication → Sign In / Providers** → turn OFF "Allow new users to sign up".
5. Open `supabase/bootstrap-owner.sql`, put your exact email in, run it. It must return one row with role `owner`.
6. **Project Settings → API** → copy Project URL and the publishable (anon) key.

## 2. Vercel (website)
1. Push this folder to a GitHub repo and import it in Vercel (Framework: Next.js).
2. Settings → Environment Variables (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Redeploy. Open the URL: you should land on `/login`; sign in; the banner "Sample data" from the old build is gone.
4. Optional: Settings → Domains to attach your own domain.

## 3. First use
Products → add SKUs → Purchases → receive opening stock (or Stock → adjustment "Add stock" for existing inventory with its cost) → Sales → record sales.

## 4. Before relying on it
- Run the checks in `docs/TEST_PLAN.md` with test data, then delete the test rows (or use a fresh project).
- Supabase Free has no guaranteed backups: use the Pro plan with daily backups, or export regularly (Reports/Products/Sales CSVs are a stop-gap, not a backup).
- Turn on MFA for your Supabase and Vercel accounts.
- Add team members only via Supabase Users; promote them in the app's Team page.
