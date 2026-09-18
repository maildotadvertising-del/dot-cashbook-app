# DOT Cash Book App — Project Context

This file is auto-loaded by Claude Code whenever this repo is opened, from any
machine or account. It exists so work on this project can continue seamlessly
across sessions/devices — read this first before doing anything else.

See [DEVLOG.md](./DEVLOG.md) for the dated session-by-session history.

## What this is

A full bookkeeping cash book web app for **Zeebas Cluster LLP**, replacing
manual cash book registers. The company has **multiple brands** under it
(DOT Advertising is one); the app is multi-brand from the ground up, not
single-business. Multi-user, GST-aware, works on mobile/tablet/web.

## Confirmed decisions

- **Scope:** Full bookkeeping — not just a simple in/out tracker. Includes
  parties, invoices/quotations, GST, receivables/payables.
- **Platform:** Web app (responsive — mobile, tablet, desktop). No native app.
- **Auth:** Multi-user login. Roles: Admin (full access), Staff (limited —
  entry only, no delete/reports).
- **Structure:** Company (Zeebas Cluster LLP) → multiple Brands. Each brand
  is its own independent cash book (own accounts, parties, categories,
  invoices, reports). Company Admin sees/manages all brands; staff can be
  scoped to specific brand(s).
- **Tech stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS +
  shadcn/ui + Supabase (Postgres DB + Auth + Storage for receipts) + Recharts
  for dashboard charts.
- **Hosting/deploy:** GitHub repo → Vercel, connected for instant deploy on
  every push.
- **GitHub repo:** https://github.com/maildotadvertising-del/dot-cashbook-app
  (renamed from `zeebas-cashbook-app`; was empty except README when we
  started).
- **Theme:** the **DOT Team App theme** — follow `DOT-Team-App-THEME.md`
  exactly (dark-only near-black with blue/purple glow, 0.05 frosted glass
  cards with 0.5px hairlines, Apple system colours, DM Sans + DM Mono). No
  light mode, no new colours. Implemented in `src/app/globals.css`.
- **Navigation:** DaVinci-Resolve-style bottom dock with three workspaces,
  each with its own sub-tabs and its **own settings** (defined in
  `WORKSPACES` in `src/components/shell.tsx`):
  1. **Items** — products & services with purchase price + sale price
     (margin shown); settings = default GST %, default unit.
  2. **Quotation & Invoices** — invoices, quotations; settings = invoice
     header (brand/legal name, GSTIN, address), number prefixes, default
     notes/terms.
  3. **Accounts** — dashboard, cash book, parties, purchase bills, fund
     transfers, review, reports; settings = accounts, categories, payment
     modes, UPI auto-capture.
  Brand switcher, Team, All-brands overview, sign-out live in the top bar.
  Existing categories are left untouched.

## Feature list (confirmed)

1. **Auth & Users** — Supabase Auth, Admin/Staff roles, multiple staff can
   log in and see shared data within their scoped brand(s).
2. **Multi-Brand & Fund Transfer** — one Company account (Zeebas Cluster
   LLP) holds multiple Brands, each an independent cash book. Company Admin
   has cross-brand access; staff can be scoped to one or more brands.
   **Inter-brand fund transfer**: a dedicated transaction type to move money
   from one brand to another — creates a linked paired entry in both brands'
   ledgers automatically (Cash Out - Transfer to [Brand B] in Brand A's
   book, Cash In - Transfer from [Brand A] in Brand B's book), so both
   ledgers stay accurate and traceable to each other.
3. **Dashboard** — cash balance, bank balance, total receivables/payables,
   income vs expense chart, recent transactions, low-balance/overdue alerts.
4. **Accounts (cash book core)** — multiple accounts (Cash, Bank(s), Petty
   Cash) per brand, Receipt/Payment/Contra entries, running balance,
   date-wise ledger, attach receipt/bill photo to entries.
5. **Parties (customers & suppliers)** — contacts with opening balance,
   party-wise ledger/statement, outstanding receivables/payables with due
   dates.
6. **Products/Services catalog** — business items to attach to
   quotations/invoices.
7. **Quotations & Invoices** — create quotations, convert to GST invoices
   (CGST/SGST/IGST calc, auto invoice numbering) **or** non-GST invoices
   (toggle per invoice) — record purchase bills from suppliers, mark
   Paid/Partial/Unpaid, PDF generation & share.
8. **Categories & transactions** — custom income/expense categories, search
   and filter by date/party/category/account.
9. **UPI/bank auto-capture via email alert parsing** — genuinely automatic,
   no manual step per transaction:
   - Each brand gets a unique inbound email address (inbound mail webhook —
     e.g. Cloudflare Email Workers, Postmark inbound, or Mailgun routes).
   - User enables bank transaction alert emails and adds a Gmail filter that
     auto-forwards them to that address. (Note: Gmail requires verifying a
     forwarding address with a code sent to it — the app must surface that
     code in the UI for the user to paste back into Gmail.)
   - Incoming alert is parsed for amount, debit/credit direction, date,
     counterparty, bank reference, and the **UPI note/narration**, then
     written into the right brand + account as an entry, flagged
     `auto-imported`.
   - Category/party is auto-suggested from how the same counterparty/VPA was
     categorized previously; entries stay flagged until a human confirms.
   - Duplicate guard on bank transaction reference so the same transaction
     can never be imported twice.
   - Per-bank parser templates (HDFC, ICICI, SBI, Axis, Kotak, …) plus a
     generic fallback parser; unparseable mails land in a review queue
     rather than being dropped.
   - **Fallback:** manual bank/UPI statement (PDF/CSV) upload with bulk
     import, for backfilling history or when email alerts miss something.
   - Real-time notification/SMS reading is deliberately NOT used: iOS never
     allows any app to read another app's notifications/SMS, and a web app
     can't use Android's Notification Listener either. Email parsing is the
     cross-platform way to get the same automation.
10. **Reports** — P&L, cash flow, party-wise outstanding, GST summary,
    per-brand and consolidated across all brands, export to Excel/PDF.
11. **Settings** — brand profile (name, GST no., logo, address for
    invoices) per brand, manage users, manage categories/accounts,
    **Integrations**
    section (connection management for bank/UPI/future integrations — not a
    literal MCP protocol feature, just called "MCP Connection settings" by
    the user informally).

## Reference: competitor audit (web.cashbook.in)

User's existing paid cash book app (CashBook, web.cashbook.in) was fully
audited live (logged-in session, all sections) as UX/feature reference —
not something to copy wholesale, but a proven feature set in this exact
category (Indian SMB cash book). Key takeaways:

- **Structure:** Business → multiple Books, each an independent ledger with
  its own members/categories/payment modes.
- **Ledger:** Cash In/Out entries with party, category, payment mode, bill
  photo, remark; filters (duration/type/party/member/mode/category);
  running Cash In / Cash Out / Net Balance; entry actions Edit/Delete/
  **Move Entry** (to another book)/**Copy Entry**/**Copy Opposite Entry**
  (mirrors as the opposite type in another book); bulk entry upload;
  activity/audit log per entry.
- **Passbook feature = confirms our earlier call:** it auto-imports bank
  transactions by reading bank SMS, which is an Android-SMS-permission
  feature only — doesn't work on iPhone. This is exactly why we chose
  statement upload/parse instead of notification/SMS reading.
- **Roles are two-tier** — worth adopting a similar shape:
  - Org-level (all books): Primary Admin (one only) → Admin → Manager
    (assigned books only) → Employee (assigned books only).
  - Book-level: Book Admin / Operator / Viewer / Data Operator, with
    granular permission toggles: backdated-entry rule (Always/Never/1-day-
    before), entry-edit permission, hide net balance & reports, hide other
    members' entries.
- **Integrations** (their real meaning of the term): sync with **Zoho
  Books** and **Tally** — good candidate for our own Integrations settings
  page, beyond just bank/UPI.
- **CashBook Payments** (their separate paid module): UPI employee expense
  wallets — admin loads prepaid wallets, employees spend via UPI with
  in-app proof attachment, admin sees real-time spend analytics/limits.
  Needs KYC + Virtual Account. Noted as a possible advanced/phase-2 idea,
  not MVP scope.
- **Business-level:** multi-business switcher, Business Team (org-wide
  members, Employee ID, "Reports To" hierarchy, wallet/invite status, CSV
  export), Subscription & Billing page, quick-start book templates (Purchase
  Order Book, Client Record, Account Book, etc.), in-app Help Docs organized
  by topic.

## Explicitly ruled out / clarified

- No native Android/iOS app — web-only, responsive.
- No real-time UPI notification/SMS capture — technically impossible on iOS
  for any app, and out of scope for a web app on Android too. Bank alert
  **email parsing** is the chosen automation path (statement upload is kept
  only as a fallback/backfill).
- Account Aggregator (Setu/Finvu) and payment-gateway webhooks were
  considered and not chosen for now — AA needs paid subscription plus
  business KYC/compliance, gateway webhooks only cover incoming payments.
  Both remain viable later if email parsing proves insufficient.
- "MCP Connection settings" = a normal integrations settings page, not a
  literal Model Context Protocol server connection.

## Status (2026-09-18)

Everything compiles and is tested offline (`npm run build`, `npx tsc
--noEmit`, `npm test` all pass), but **nothing has run against a live
Supabase project yet** — that's blocked on the user creating one (see
"Next steps").

Built:
- Next.js 16 + React 19 + Tailwind v4 + TypeScript, Liquid Glass design
  system in `src/app/globals.css`. Login verified visually in light/dark and
  mobile; other screens need a live DB to render.
- Auth with **invite-only signup**: first signup becomes company owner;
  later signups need a row in `company_invites` (by email), otherwise they
  land on a "waiting for invite" screen with no data access.
- Company → Brands, brand switcher, brand creation with seeded defaults.
- Cash book ledger (filters, pagination, add/edit/delete, inline master
  creation, Excel export, receipt photo attach via Supabase Storage).
- Dashboard, parties + statements, items, quotations, invoices, **purchase
  bills** (shared document components via `src/lib/doc-meta.ts`), payments
  that post matching ledger entries, quotation → invoice conversion.
- Reports (P&L, cash flow, outstanding, GST) with Excel export.
- Inter-brand fund transfers, all-brands overview.
- UPI auto-capture: bank alert email parser + `/api/inbound` webhook,
  **review queue** (`/b/[brand]/review`) that learns counterparty →
  category/party rules and surfaces the Gmail forwarding code, and
  **statement import** (`/b/[brand]/import`, Excel/CSV) keyed on the UPI
  ref so statement + email imports of the same payment can't double up.
- **Team** page (`/company`): invites, company role (admin/staff), per-brand
  access with role (admin/operator/viewer) and toggles (edit own, delete
  own, see others' entries, see balances/reports, backdate rule).
- **Access control is enforced in Postgres RLS** (migration 0005), not just
  hidden in UI: viewers are read-only, backdate rules checked in IST,
  operators edit/delete only their own entries, staff only see their
  brands, users can't change their own role.

Tests (`npm test`):
- `tests/bank-parser.test.mts` — alert email formats (HDFC/SBI/ICICI/Axis/
  Kotak), promo-mail rejection.
- `tests/statement.test.mts` — statement header detection, Dr/Cr and split
  columns, Excel dates, UPI narration parsing, ref normalisation.
- `tests/migrations.test.mts` — applies every migration to PGlite with auth/
  storage stubs and checks signup, RLS, permissions, invoice numbering and
  payment status.

## Deployment (live since 2026-09-18)

- **Live app:** https://dot-cashbook-app.vercel.app (Vercel project
  `dot-cashbook-app`, Hobby, functions pinned to Mumbai `bom1` via
  `vercel.json`, auto-deploys on push to `main`).
- **Supabase:** project `dot-cashbook` (ref `grhwylmjrmvlnnaqtrlt`, org "DOT
  Advertising", region ap-south-1 Mumbai). Schema applied from
  `supabase/setup-all.sql`. Auth Site URL = the Vercel URL; redirect allow
  list has `http://localhost:3000/**`.
- Env vars live in `.env.local` (gitignored) and in Vercel project settings.
  `NEXT_PUBLIC_*` are inlined at build time — changing them on Vercel needs a
  redeploy **without** build cache. Vercel auto-detects `.env.example` on
  import and pre-fills its placeholders; that caused the first deploy to 500.
- Owner account created; company "Zeebas Cluster LLP", brand "DOT
  Advertising" (GSTIN 33AAEFZ1730G1ZF) exist in production data.

## Next steps

1. (Declined by user 2026-09-18) The Supabase secret key appeared in chat
   twice; user chose not to rotate it. Re-offer only if something changes.
2. Inbound email provider (Cloudflare Email Workers / Postmark / Mailgun) →
   POST `/api/inbound` with `x-webhook-secret`; set
   `NEXT_PUBLIC_INBOUND_DOMAIN`; set up Gmail forwarding.
3. Walk the remaining flows on production with real data (invoice create →
   PDF, payments, transfers between two real brands, team invite).

Not built yet: PDF statement import (Excel/CSV only), Zoho Books/Tally
integrations, entry move/copy between books UI (server action
`copyTransaction` exists), activity log viewer.

## Environment notes

The project lives on an SMB network share (`/Volumes/BackUp`), which matters:
- Turbopack's persistent cache cannot fsync there, so both `.next/cache`
  (build) and `.next/dev/cache` (dev) are symlinks to local dirs. If `.next`
  is ever deleted, recreate them:
  `mkdir -p .next/dev && ln -sfn ~/.dot-cashbook-cache .next/cache && ln -sfn ~/.dot-cashbook-dev-cache .next/dev/cache`.
- The preview tool's `npm run dev` hangs on this share; start the dev server
  with `node node_modules/next/dist/bin/next dev -p 3000` instead.
- `node_modules` must be a real directory in the project (npm replaces a
  symlink), so installs are slow but correct.

## Working agreement

- Keep this file and DEVLOG.md updated as decisions are made or features are
  added/changed, so any future session (any account) has full context just by
  opening this repo.
- Commit and push progress regularly so GitHub is always the source of truth.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
