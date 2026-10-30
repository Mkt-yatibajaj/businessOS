# Security model and operator guidance

- The frontend only uses Supabase URL and publishable/anon key. Never add service-role/secret keys to Vercel `NEXT_PUBLIC_*` variables, source files or GitHub.
- Middleware calls `auth.getUser()` (server-validated) and redirects anonymous requests to `/login`. Supabase RLS remains the final authorization boundary.
- New Auth accounts get `viewer` role via database trigger. The bootstrap SQL is a privileged one-time promotion for the initial trusted owner.
- RLS is enabled on profiles and all business tables. Profile reads are self/owner/admin; business rows require an authenticated profile. Mutating catalog data requires operator/admin/owner.
- Purchase and sales ledger tables have SELECT policies only. Client-side inserts are not granted; posting occurs via `SECURITY DEFINER` RPCs that verify role and execute atomically.
- Transaction RPCs validate positive quantities and active product; sales lock product and FIFO lot rows and reject overselling.
- Audit records are inserted inside the posting transaction. Direct client writes to audit log are not granted.

## Before production
1. Review SQL with a qualified database/security reviewer before applying to a business database.
2. Use a dedicated Supabase project and least-privilege dashboard access.
3. Test RLS using an anonymous session, viewer, and owner.
4. Configure Supabase database backups/exports and test a restore into a separate project. Supabase Free does not provide all paid backup features; verify current plan capabilities.
5. Enable MFA for owner email and use a strong unique password.
6. Monitor Supabase Auth and database logs; rotate keys if exposed.
7. Keep Vercel commercial-use plan terms in mind; verify the plan is permitted for your business use.
