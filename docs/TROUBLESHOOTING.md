# Troubleshooting and Safe Recovery

## `npm` command not found
Install Node.js LTS from https://nodejs.org/, close and reopen the terminal, then run `node -v` and `npm -v`.

## `git` command not found
Install Git from https://git-scm.com/downloads and reopen the terminal.

## `npm install` fails
Copy the full error output. Check internet connection and Node version. Do not delete lockfiles or change dependency versions randomly.

## Git says `remote origin already exists`
Run `git remote -v`. If it points to the wrong repo, update it deliberately:

```bash
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/advaitum-business-os.git
```

## Git asks for credentials
Use GitHub's official authentication flow or Git Credential Manager. Never share a token in chat, screenshot, source code or `.env` file.

## Cloudflare build says output directory missing
Confirm `next.config.ts` contains `output: 'export'`, run `npm run build`, and confirm the `out/` directory exists. Set Cloudflare Pages output directory to `out`. If the app is nested in a monorepo, set the correct root directory.

## Website loads but database does not work
The starter UI currently uses sample state and is not connected to Supabase. A hosted demo does not mean database integration is complete. Implement the client, authentication, policies and persistence first.

## Supabase returns permission/RLS errors
This is often expected until proper RLS policies and grants are implemented. Do not solve it by creating an unrestricted policy. Inspect the policy, user session and table grants.

## Secret key was committed
Assume it is exposed. Rotate/revoke it in the provider dashboard, remove it from active code, clean Git history if needed, and check logs. Removing a secret from the latest file alone does not invalidate it.

## Data appears missing
Do not keep retrying writes or create duplicate records. Check the selected project, user identity, RLS policies and transaction status. Before real launch, test backup and restore in a separate project.
