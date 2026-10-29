# Advaitum Business OS — Free Launch Guide
**Version:** 1.0 · **Prepared:** 29 October 2026

## What you are building
A responsive browser-based business app for SKU management, purchases and purchase lots, sales by channel/location, inventory, profitability and reporting.

## Recommended ₹0 starter stack
- **Code:** Next.js 15 + TypeScript (included in starter)
- **Source control:** GitHub Free, private repository
- **Hosting:** Cloudflare Pages on a `*.pages.dev` address
- **Database/auth:** Supabase Free
- **Editor:** VS Code
- **Cost target:** ₹0 to start, within free-plan limits. Free plans have limits and can change.

**Why Cloudflare Pages, not Vercel Hobby?** Vercel's Hobby plan is restricted to personal, non-commercial use. Advaitum is a business, so use a hosting option whose current terms allow your intended use. Verify the latest terms before launch.

## Important status of the supplied starter
The supplied starter is a **UI demo**, not a production inventory system. The current dashboard uses sample records in React state; refreshing the page resets those demo changes. The SQL file is only a starting schema. Authentication, RLS policies, real database persistence, transaction-safe stock changes, returns and tested reporting still need to be implemented.

**Do not enter real inventory or financial data until the production checklist in `PRODUCTION_CHECKLIST.md` is complete.**

## Phase 1 — Prepare your computer
1. Install the current Node.js LTS release from https://nodejs.org/.
2. Install Git from https://git-scm.com/downloads.
3. Install VS Code from https://code.visualstudio.com/.
4. Download and extract `advaitum-business-os-starter.zip`.
5. Open the extracted `advaitum-app` folder in VS Code.
6. Open VS Code Terminal → New Terminal and run:

```bash
node -v
npm -v
git --version
npm install
npm run dev
```

7. Open http://localhost:3000 in Chrome.
8. Stop the server with `Ctrl+C` in the terminal.

If `npm install` or `npm run dev` fails, copy the complete error message before trying random fixes.

## Phase 2 — Create the private GitHub repository
1. Go to https://github.com/new.
2. Repository name: `advaitum-business-os`.
3. Choose **Private**.
4. Do not initialize with a README or licence (the starter already contains files).
5. In the VS Code terminal, ensure you are inside the `advaitum-app` folder and run:

```bash
git init
git add .
git commit -m "Initial Advaitum Business OS starter"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/advaitum-business-os.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your real GitHub username. If Git asks you to authenticate, use GitHub's supported sign-in/token flow; never paste a token into chat or commit it to a file.

Before pushing, confirm `.env.local` is not staged:

```bash
git status
```

Never commit `.env.local`, passwords, access tokens, or a Supabase service-role/secret key.

## Phase 3 — Create Supabase project
1. Open https://supabase.com/dashboard and create a project on the Free plan.
2. Save the database password in a password manager or another secure place.
3. In Project Settings, find the project URL and the publishable key (older projects may call it the `anon` key).
4. Do not use the `service_role` or secret key in browser code or in any `NEXT_PUBLIC_` variable.
5. Open **SQL Editor** and review `supabase/migrations/0001_initial_schema.sql`.
6. Run the schema in a development project only after reviewing it. The current schema enables RLS but does not yet provide the complete policies needed for a working app; do not expose business tables until policies are implemented and tested.
7. Free projects may pause after a period of inactivity, and free plans do not include all backup/recovery features. Plan a regular export and test restore procedure.

## Phase 4 — Configure the app for free Cloudflare Pages hosting
The current starter is a client-side dashboard with no Next.js server routes. For this starter, a static export is the simplest hosting path; Supabase can be accessed from the browser using the publishable key plus correctly configured Row Level Security.

1. In `next.config.ts`, update the config to:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

2. If using Next.js image optimization later, static export may require unoptimized images or an external image service. The current starter does not require a Next.js image optimizer.
3. Run a local production build:

```bash
npm run build
```

4. Confirm an `out/` folder is generated and that the build finishes successfully.
5. Commit and push the config change:

```bash
git add next.config.ts
git commit -m "Configure static export for Cloudflare Pages"
git push
```

If the application later needs server-only features, server actions, API routes, or secret credentials, do not put those secrets in the browser. Reassess the deployment architecture before adding those features.

## Phase 5 — Deploy from GitHub to Cloudflare Pages
1. Open https://dash.cloudflare.com/ and create/sign in to a Cloudflare account.
2. Go to **Workers & Pages** → **Create** → **Pages** → connect to Git.
3. Connect GitHub and choose the private `advaitum-business-os` repository.
4. Use these build settings for this static-export setup:
   - Framework preset: **Next.js (Static HTML Export)** if offered; otherwise choose **None**
   - Build command: `npm run build`
   - Build output directory: `out`
   - Root directory: `advaitum-app` only if the repository contains the app in that subfolder; if you pushed the contents of `advaitum-app` as the repository root, leave root directory blank.
5. Deploy. Cloudflare should provide a `*.pages.dev` URL.
6. Open the URL on laptop and mobile Chrome.
7. A successful deploy only proves that the UI is hosted. It does **not** mean Supabase persistence or production security has been implemented.

## Phase 6 — Connect Supabase only after the integration code exists
The `.env.example` file documents the expected public values:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

For local development, copy `.env.example` to `.env.local` and fill the values. For Cloudflare Pages, set the same public environment variables in the Pages project settings and trigger a new build. These values are public client configuration; database security must be enforced by Supabase RLS policies and database permissions. Never put a service-role/secret key in a public variable.

## Phase 7 — Build real features in this order
1. Authentication: sign-in/sign-out and owner-only access at first.
2. Database access layer: products/categories and supplier records.
3. Purchases: purchase headers, purchase lines, lot-level costs and landed-cost allocation.
4. Inventory ledger: every receipt, sale, return, damage and adjustment creates a movement record.
5. Sales: channel, location/event, order reference, quantity, discount, fees, shipping and payment method.
6. Atomic posting: database function/transaction validates stock and writes the sale, sale items, COGS and stock movements together.
7. Costing method: choose weighted average or FIFO explicitly and test it. Do not mix methods.
8. Reports: date range, SKU, category, channel and location filters; revenue, COGS, gross profit, contribution and inventory value.
9. CSV import/export: validate columns, duplicate records and quantities before import.
10. Backups and audit trail: export regularly and test a restore before real use.

See `DATABASE_AND_REPORTS.md`, `PRODUCTION_CHECKLIST.md`, and `AI_CODING_PROMPT.md`.

## Business definitions to use consistently
- **Net product revenue:** item sales minus discounts and refunds; report shipping collected separately if applicable.
- **COGS:** units sold multiplied by the recorded cost under the chosen costing method at sale time.
- **Gross profit:** net product revenue minus COGS.
- **Contribution:** gross profit minus directly attributable channel fees, shipping, packaging and other selling costs.
- **Stock on hand:** opening stock + receipts + returns − sales − damage/adjustments out.
- **Inventory value:** stock on hand valued using the selected costing method.

## Free-plan caveats
- Free-plan quotas, inactivity rules and terms may change. Re-check official pricing and terms before launch.
- Supabase Free may pause inactive projects and does not include all automated backup features.
- Cloudflare Pages provides a free `pages.dev` subdomain; a custom domain generally requires owning a domain.
- A free host is not a substitute for access control, backups, or transaction testing.
- Do not import sensitive customer data unless it is actually needed; keep access restricted.

## Official documentation
- Node.js: https://nodejs.org/
- Git: https://git-scm.com/downloads
- GitHub: https://docs.github.com/
- Next.js static export: https://nextjs.org/docs/app/guides/static-exports
- Cloudflare Pages: https://developers.cloudflare.com/pages/
- Supabase pricing: https://supabase.com/pricing
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript client: https://supabase.com/docs/reference/javascript/introduction
- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
