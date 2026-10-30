# Deployment guide

## Supabase
1. Create a dedicated Supabase project for Advaitum.
2. Open SQL Editor and run `supabase/migrations/0001_advaitum_core.sql` once, on an empty project. If you already have tables from an earlier prototype, do not blindly rerun this file; inspect and migrate/backup first.
3. Go to Authentication → Users → Add user. Create your own email/password account.
4. Edit `supabase/bootstrap-owner.sql`: replace `YOUR-ADMIN-EMAIL@example.com` with the exact account email. Run it in SQL Editor. Confirm the returned row has role `owner`.
5. Authentication → URL Configuration: set Site URL to your deployed Vercel URL. Add local and production callback/redirect URLs if you later enable email links. This app uses password login.
6. Keep public sign-ups disabled in Supabase Auth settings if only the owner should create accounts.

## Vercel
1. Push the project folder contents to the GitHub branch connected to Vercel.
2. Import/connect the repository in Vercel. Framework: Next.js; build command `next build`; install command `npm install`.
3. Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase publishable key (or legacy anon key)
4. Apply to the environments you use and redeploy after saving.
5. Open the deployed URL. Unauthenticated visitors should be redirected to `/login`.

## Local run
```bash
cp .env.example .env.local
# edit .env.local with actual Supabase URL and publishable key
npm install
npm run dev
```

## First sign-in test
Sign in with the user created in Supabase. If the profile role is missing, run:
```sql
select u.email,p.role from auth.users u left join public.profiles p on p.id=u.id;
```
Only promote the trusted administrator using the supplied bootstrap SQL. Do not share database passwords or service-role keys.
