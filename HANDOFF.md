# Handoff — continue this project in another Claude account

Read this together with [CLAUDE.md](./CLAUDE.md) (what the app is + every
confirmed decision) and [DEVLOG.md](./DEVLOG.md) (dated history). This file
covers only what does **not** travel with the git clone: credentials, machine
setup, working rules, and the exact steps to pick the work back up.

Written 2026-11-02, from the session that built the app (last commit at the
time: `4cad143` "Tone down the theme's glow").

---

## 1. Quick start for the new session

Say to Claude in the new account:

> Read CLAUDE.md, HANDOFF.md and DEVLOG.md in this repo, then continue.

Then:

```bash
git clone https://github.com/maildotadvertising-del/dot-cashbook-app.git
cd dot-cashbook-app
npm install
```

(If you are on the **same Mac**, the project already exists at
`/Volumes/BackUp/DOT-Claude/DOT-CASH Book App` — just open that folder
instead of cloning. Everything below still applies.)

Then create `.env.local` (see §3), and verify:

```bash
npm test
```

```bash
npm run build && node node_modules/next/dist/bin/next start -p 3000
```

---

## 2. Accounts and services

| Thing | Where | Notes |
|---|---|---|
| GitHub repo | https://github.com/maildotadvertising-del/dot-cashbook-app | branch `main`, source of truth |
| Live app | https://dot-cashbook-app.vercel.app | Vercel project `dot-cashbook-app`, Hobby plan |
| Vercel region | `bom1` (Mumbai) | pinned in `vercel.json` |
| Supabase project | `dot-cashbook`, ref `grhwylmjrmvlnnaqtrlt` | org "DOT Advertising", region `ap-south-1` (Mumbai) |
| Supabase dashboard | https://supabase.com/dashboard/project/grhwylmjrmvlnnaqtrlt | |
| Company in the data | Zeebas Cluster LLP | |
| First brand | DOT Advertising, GSTIN `33AAEFZ1730G1ZF` | |

Deploys are automatic: every push to `main` deploys to Vercel.

Supabase Auth settings already done: Site URL = the Vercel URL; redirect allow
list includes `http://localhost:3000/**`.

---

## 3. Environment variables (the only thing the user must paste)

`.env.local` is **gitignored**, so a fresh clone has no credentials. Four
variables are needed, both locally and in Vercel → Settings → Environment
Variables:

```
NEXT_PUBLIC_SUPABASE_URL          https://grhwylmjrmvlnnaqtrlt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     Supabase → Project Settings → API Keys → publishable/anon key
SUPABASE_SERVICE_ROLE_KEY         Supabase → Project Settings → API Keys → secret/service_role key
INBOUND_WEBHOOK_SECRET            any long random string; must match what the inbound email provider sends
```

`.env.example` in the repo has the same shape with placeholders.

**Claude must not type or paste these values anywhere.** Claude prepares the
file/form and the user pastes the value in (see §5). The two Supabase keys are
read from the Supabase dashboard by the user; `INBOUND_WEBHOOK_SECRET` can be
any value the user chooses, but if it changes it must be changed in Vercel too.

Gotchas:
- `NEXT_PUBLIC_*` variables are **inlined at build time**. Changing them on
  Vercel needs a redeploy **without build cache**, otherwise the old value
  stays baked in.
- On a fresh Vercel import, Vercel auto-detects `.env.example` and pre-fills
  its *placeholders*. That caused the first deploy to 500 with
  "Invalid supabaseUrl". Delete the placeholder vars and add the real ones.
- The user declined rotating the Supabase secret key on 2026-09-18 (it had
  appeared in chat): "secret key apdiyye irukanttum no prblm". Do **not**
  rotate it unless they ask.

There is also `NEXT_PUBLIC_INBOUND_DOMAIN`, not yet set — it is only needed
once the inbound email provider exists (§7).

---

## 4. Machine / environment notes (important on this Mac)

The project lives on an **SMB network share** (`/Volumes/BackUp`), which breaks
a few things:

- Turbopack's persistent cache cannot fsync there ("Operation not supported
  (os error 45)"). **This is handled in `next.config.ts`**: both
  `experimental.turbopackFileSystemCacheForBuild` and
  `…ForDev` are switched off unless `process.env.VERCEL` is set, so local
  builds skip the on-disk cache entirely and Vercel keeps it. No symlinks are
  needed any more. (Earlier sessions symlinked `.next/cache` and
  `.next/dev/cache` to `~/.dot-cashbook-cache` / `~/.dot-cashbook-dev-cache`;
  that workaround is obsolete and those symlinks can be deleted.)
- **macOS caches SMB symlinks badly.** If the share is ever remounted while
  files are open, existing symlinks can go stale: `ls` reports
  "Invalid argument", and every shim in `node_modules/.bin` stops working
  (`sh: tsx: command not found`), because they are symlinks. Rewriting them
  does not help — the kernel keeps serving the stale entry for that exact
  path. **Fix: unmount and remount the share** (or reboot). Until then, run
  the tools by their real path:
  ```bash
  node node_modules/tsx/dist/cli.mjs tests/migrations.test.mts
  ```
  ```bash
  node node_modules/typescript/bin/tsc --noEmit
  ```
  ```bash
  node node_modules/next/dist/bin/next build
  ```
- `node_modules` must be a **real directory** inside the project. npm replaces
  a symlink with a real directory anyway. Installs are slow but correct.
- The preview tool's `npm run dev` **hangs** on this share. Start dev with:
  ```bash
  node node_modules/next/dist/bin/next dev -p 3000
  ```
  The dev server has been unreliable on the share (thousands of spurious
  "Module not found"), so for verification prefer a production build:
  `npm run build && node node_modules/next/dist/bin/next start -p 3000`.
- `.claude/launch.json` is gitignored. On a new machine, recreate it if you
  want the preview tool:
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 } ] }
  ```

On a normal local disk none of this applies — plain `npm run dev` is fine.

---

## 5. Working rules (carried over from the first account's memory)

These were explicit user instructions. Local Claude memory does not travel
between accounts, so they live here.

1. **Claude does every step itself.** Navigating Supabase / Vercel / GitHub
   dashboards, running SQL, configuring settings, deploying, testing — Claude
   does it, through the browser tools or Bash. Do not hand the user a list of
   steps for something Claude can do.
   The user personally does only three kinds of thing:
   - **Passwords and secrets** (API keys, secret/service keys, tokens). Claude
     must never type or paste these anywhere. Prepare everything around it —
     open the exact form, put the value on the clipboard with `pbcopy` from
     `.env.local` without printing it — so the user's part is one paste + save.
   - **Remove / delete clicks.**
   - **Approvals / confirmations.**
   (Said on 2026-09-18: "neeye pannu… password, remove or delete and approval
   ku mattum nan pannuven.")
2. **Never echo secret values into chat.** To inspect `.env.local`, print key
   names only:
   ```bash
   awk -F= '{print $1}' .env.local
   ```
3. **Reply in Tanglish** (Tamil written in Latin script, mixed with English) —
   that is how the user writes.
4. **Do not import the user's Wallet (BudgetBakers) history.** They said
   explicitly: "Entries yethuvum add pannavenam. import and transfer option
   mattum propera work aana pothum." Build/verify the import feature with
   sample files; never write their real entries into the app.
5. **Do not add entries to live production data** without being asked.
6. Keep `CLAUDE.md` and `DEVLOG.md` updated as decisions are made, and commit
   + push regularly so GitHub stays the source of truth.

---

## 6. How the code is laid out

```
src/app/(app)/b/[brandId]/…   per-brand pages: dashboard, cashbook, parties,
                              items, invoices/quotations/bills, transfers,
                              recurring, review, reports, import, settings
src/app/(app)/company         team / invites / per-brand access
src/app/(app)/overview        all-brands consolidated view
src/app/actions/*.ts          server actions (transactions, documents, team,
                              labels, statement import, inbound, …)
src/components/shell.tsx      top bar + sub-tabs + the bottom workspace dock
                              (WORKSPACES array defines the 3 workspaces)
src/components/ui.tsx         PageHeader, GlassCard, StatCard, Modal, Field…
src/app/globals.css           the whole liquid-glass design system
src/lib/                      supabase clients, permissions, gst, doc-meta,
                              bank-parser, statement, rules, auto-classify…
supabase/migrations/000*.sql  schema, all applied to the live project
supabase/setup-all.sql        all migrations concatenated (fresh-project setup)
tests/*.test.mts              bank parser, statement parser, rules, migrations
```

**Database changes**: add a new `supabase/migrations/00NN_*.sql`, apply it in
the Supabase SQL editor, then regenerate the combined file:

```bash
{ echo "-- DOT Cash Book — all migrations combined, newest project setup."; for f in supabase/migrations/0*.sql; do echo; echo "-- ==== $f"; cat "$f"; done; } > supabase/setup-all.sql
```

`npm test` runs the PGlite migration test, which applies every migration and
asserts the RLS rules — run it after any SQL change.

**Access control is enforced in Postgres RLS** (migration 0005), not just in
the UI. If you change permissions, change the policy, not only the component.

**Next.js 16 notes**: `middleware.ts` is now `proxy.ts` with
`export async function proxy()`; `next dev` appends an agent-rules block to
`CLAUDE.md` — keep it committed, it regenerates otherwise.

---

## 7. What is left to do

1. **Inbound email provider** (the only big unfinished feature). Pick one of
   Cloudflare Email Workers / Postmark inbound / Mailgun routes, point it at
   `POST https://dot-cashbook-app.vercel.app/api/inbound` with header
   `x-webhook-secret: <INBOUND_WEBHOOK_SECRET>`, set
   `NEXT_PUBLIC_INBOUND_DOMAIN` in Vercel, then set up the Gmail auto-forward
   filter for bank alert mails. Gmail sends a verification code to the
   forwarding address — the app surfaces it on `/b/[brand]/review`.
2. **Walk the remaining flows on production with real data**: invoice create →
   PDF, record a payment, a transfer between two real brands, a team invite.
   The first live fund transfer has not been submitted yet.
3. Not built at all yet:
   - PDF statement import (Excel/CSV only today)
   - Zoho Books / Tally integrations
   - entry move/copy between books **UI** (the server action `copyTransaction`
     already exists)
   - activity-log viewer

---

## 8. Verification checklist before any commit

```bash
npm test && npx tsc --noEmit && npm run build
```

All three passed at `4cad143`. Then commit and push to `main`; Vercel deploys
automatically and `https://dot-cashbook-app.vercel.app/login` should return
HTTP 200 within a minute or two.
