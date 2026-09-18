# Dev Log

Dated log of decisions and progress. Newest entry on top.

## 2026-09-18 (go-live)

- Supabase project created by the user; schema applied via SQL editor;
  owner signed up; DOT Advertising brand created. All 18 screens verified
  rendering against real data.
- Performance pass: pages went from 0.5–1.1s to ~0.12–0.4s locally by
  replacing auth-server `getUser` with local `getClaims`, caching the client
  and permissions per request, parallelising queries, and dropping the
  redundant client `router.refresh()` after server actions.
- Fixed: entry form wiped itself when an inline-created party/category
  refreshed the page; dropdown menus unreadable inside glass modals.
- Deployed to Vercel (Mumbai region). First deploy 500'd on placeholder env
  vars imported from `.env.example`; replaced with real ones and redeployed.
- Dev server on the SMB share is unreliable with a cold Turbopack cache; the
  user chose to keep the project on the share, so local testing uses
  `next build && next start`.

## 2026-09-17 / 18

- Built the remaining "not yet" list: purchase bills, auto-import review
  queue (with learned counterparty rules and Gmail code surfacing), bank
  statement import (Excel/CSV), receipt photo attachments, team management.
- Found and fixed three access-control holes before any real data existed:
  any signup silently joined the company, staff could promote themselves
  via their own profile row, and per-brand permission toggles were UI-only.
  Signup is now invite-only and permissions are enforced by RLS.
- Added a PGlite-based migration test so SQL and RLS are verified without a
  Supabase project; it caught nothing wrong beyond a `pgcrypto` line PGlite
  can't load (removed — `gen_random_uuid()` is core Postgres).
- Statement import keys rows on the UPI ref inside the narration (not the
  bank's ref column, which can be non-unique like "TRANSFER TO 4897"), so a
  statement and an alert email for the same payment dedupe.
- Login page checked in the browser (light/dark, mobile). Signup now tells
  the user to confirm their email when Supabase email confirmation is on.
- Still waiting on Supabase credentials from the user.

## 2026-09-16 (build session)

- Build started and the first full pass landed: scaffold, design system,
  auth, schema + RLS, cash book, dashboard, parties, items, quotations and
  invoices (GST and non-GST), reports, settings, inter-brand transfers,
  all-brands overview, and the bank alert email parser with its webhook.
  `npm run build`, `npx tsc --noEmit`, and `npm test` all pass.
- Stopped short of running against a live database — the user will create
  the Supabase project next session. CLAUDE.md "Next steps" has the exact
  sequence to resume from.
- Environment gotchas found and worked around (both recorded in CLAUDE.md):
  the project sits on an SMB share, so Turbopack's cache had to move to a
  local symlinked directory, and node_modules cannot be symlinked away.

## 2026-09-16

- UPI auto-capture upgraded from manual statement upload to **bank alert
  email parsing** — a unique inbound address per brand, Gmail auto-forward
  rule, webhook parses amount/direction/date/counterparty/UPI note and
  writes the entry automatically with a duplicate guard on bank reference.
  Statement upload stays as fallback/backfill. Account Aggregator and
  payment-gateway webhooks were presented and declined for now (cost,
  KYC, and incoming-only coverage respectively).
- Structural change: the app is for **Zeebas Cluster LLP**, which runs
  multiple brands (DOT Advertising is one of them). Modeled as Company →
  multiple Brands, each brand an independent cash book. Company Admin gets
  cross-brand access; staff scoped to specific brands.
- Added **inter-brand fund transfer** as a first-class transaction type:
  one action creates a linked paired entry in both brands' ledgers (out of
  the sending brand, into the receiving brand) so both stay accurate and
  traceable.
- Reports now need both per-brand and consolidated (all-brand) views.

## 2026-09-12 (cont'd)

- Audited the user's existing paid CashBook app (web.cashbook.in) live via
  browser — every major section (ledger, filters, entry detail/actions,
  book settings, roles/permissions, Business Team, Business Payments/UPI
  wallets, Integrations, Subscription, Help Docs). Full findings captured
  in CLAUDE.md under "Reference: competitor audit". Highlights: two-tier
  role model (org-level + book-level) worth adopting; their "Passbook" auto
  bank-SMS-read feature is Android-only, confirming our statement-upload
  approach; "Integrations" there means Zoho Books/Tally sync — added as an
  idea for our own Integrations settings.

## 2026-09-12

- Repo `zeebas-cashbook-app` found (created 2026-06-15, empty except README)
  and renamed to `dot-cashbook-app`. Cloned locally to this folder, remote
  updated.
- Gathered full feature scope through a series of clarifying questions (see
  CLAUDE.md for the confirmed list). Key decisions locked in:
  - Full bookkeeping scope (parties, invoices, GST, receivables/payables).
  - Web app, responsive across mobile/tablet/desktop.
  - Multi-user login with Admin/Staff roles.
  - Stack: Next.js + TypeScript + Tailwind + shadcn/ui + Supabase.
  - Deploy: GitHub → Vercel, instant deploy on push.
  - Theme: iOS "Liquid Glass" (frosted/translucent UI).
  - UPI/bank transactions: semi-automatic via statement upload + parse
    (real-time notification reading ruled out — not possible on iOS for any
    app, and out of scope for a web app on Android).
  - "MCP Connection settings" clarified to mean a normal Integrations
    settings page, not a literal MCP protocol feature.
  - Products/services catalog + Quotations, with GST and non-GST invoice
    options.
- Set up CLAUDE.md + this DEVLOG.md for cross-session/cross-account
  continuity — any Claude Code session opening this repo gets full context.
- Build not started — user has more requirements to share first.
