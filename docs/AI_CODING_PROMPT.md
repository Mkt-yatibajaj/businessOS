# AI Coding Agent Prompt — Build the Production App Safely

Copy this prompt into your coding agent after opening the `advaitum-app` repository. Work in small, reviewable steps. Do not ask the agent to build everything in one giant change.

---

You are a senior full-stack engineer. Continue the existing Advaitum Business OS repository (Next.js 15.5, TypeScript, React, Supabase/PostgreSQL). The current UI is a demo using in-memory sample data. Do not represent it as production-ready.

Business requirements:
- Responsive Chrome-first UI for laptop, tablet and mobile.
- Product/SKU CRUD with category, variant, unit, default selling price and active/inactive status.
- Purchases with supplier, date, invoice reference, multiple items, purchase lot and allocated landed costs.
- Sales with date, SKU, quantity, actual price, discounts, channel, location/event, order reference, payment method, channel fees, packaging and shipping.
- Inventory ledger with receipts, sales, returns, damage and adjustments.
- Date-range, SKU, category, channel and location reports; CSV export.
- Authentication, strict authorization, RLS, audit trail, backups and import validation.
- Costing method must be explicitly configured as weighted average or FIFO. Never mix methods silently.
- Currency is INR; format using Indian number conventions.
- Keep all data in Supabase, not browser memory/localStorage as the source of truth.

Security and correctness:
1. Inspect the repository before changing files. Explain the plan and list the files to change.
2. Never put a Supabase service-role/secret key in browser code or any `NEXT_PUBLIC_` variable.
3. Enable RLS on all exposed tables and add least-privilege policies. Do not add permissive policies such as `using (true)` for business data.
4. Use the Supabase publishable/anon key only with RLS and appropriate grants.
5. Implement sale posting and stock movements using a PostgreSQL function/transaction so sale header, lines, COGS and stock changes commit atomically.
6. Use a stable SKU uniqueness constraint and duplicate import detection.
7. Do not hard-delete posted financial or inventory transactions; use reversals/returns and audit entries.
8. Add validation and useful loading/error/success states.
9. Add tests for costing, returns, concurrent stock updates, discounts, zero revenue, and report reconciliation.
10. Do not fabricate business data. Label demo data clearly and provide a safe empty state.
11. Keep free-tier deployment in mind. The current frontend is client-side and can be configured for Next.js static export + Cloudflare Pages if no server-only feature is introduced. Reassess before adding server routes or secrets.
12. Run TypeScript/build/lint/tests where available and report exact results. Do not claim tests passed unless actually run.

Build in milestones:
A. Review current schema and propose final schema + RLS matrix.
B. Implement authentication and owner-only policies.
C. Implement products and categories with database persistence.
D. Implement purchases and stock receipt ledger.
E. Implement atomic sales posting and chosen costing method.
F. Implement returns/adjustments.
G. Implement reports and CSV export.
H. Implement import, audit trail, backup/restore notes, responsive QA.

Before each milestone, state assumptions and acceptance criteria. After each milestone, list changed files, migrations, commands run, test results and remaining risks. Do not silently change business calculation definitions.
