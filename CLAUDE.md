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
- **Theme:** iOS "Liquid Glass" style — translucent/frosted glass UI
  (backdrop-filter blur, layered translucency), Apple-style.

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

## Status (2026-09-16)

Build is underway. Everything below compiles (`npm run build` passes,
`npx tsc --noEmit` clean, `npm test` passes) but **nothing has been run
against a real database yet** — see "Next steps".

Done:
- Next.js 16 + React 19 + Tailwind v4 + TypeScript, Liquid Glass design
  system in `src/app/globals.css` (glass utilities, light/dark tokens).
- Supabase auth (email/password), session refresh in `src/middleware.ts`.
- Schema in `supabase/migrations/` — 0001 tables + RLS, 0002 balance views
  and summary functions, 0003 document numbering + payment sync trigger.
- Company → Brands structure, brand switcher, brand creation with seeded
  default accounts/categories/payment modes.
- Cash book ledger: filters, pagination, summary, entry add/edit/delete,
  inline party/category/mode creation, Excel export.
- Dashboard with 30-day cash flow chart, receivable/payable, unpaid invoices.
- Parties list + party statement page. Items catalog.
- Quotations & invoices: editor with GST/non-GST toggle, auto intra/inter
  state detection, line items, totals, print-ready view, payment recording
  that also posts the cash book entry, quotation → invoice conversion.
- Reports: P&L, cash flow, outstanding, GST summary, multi-sheet Excel export.
- Settings: brand profile, accounts, categories, payment modes, and the
  email auto-capture setup screen.
- Inter-brand fund transfers (paired linked entries) and an all-brands
  overview.
- Bank alert email parser (`src/lib/bank-parser.ts`) + inbound webhook at
  `/api/inbound`, with tests in `tests/bank-parser.test.mts` covering HDFC,
  SBI, ICICI, Axis, Kotak formats and promotional-mail rejection.

## Next steps

1. **User creates a Supabase project** (free tier) and provides Project URL,
   anon key, and service_role key. Put them in `.env.local` (see
   `.env.example`).
2. Apply `supabase/migrations/*.sql` in order via the Supabase SQL editor.
3. Run `npm run dev`, sign up (first signup becomes the company owner and
   creates the company row), create brands, and walk every screen.
4. Connect the repo to Vercel for instant deploy; add the same env vars there.
5. Set up inbound email (Cloudflare Email Workers / Postmark / Mailgun) to
   POST to `/api/inbound` with the `x-webhook-secret` header, then walk the
   user through the Gmail forwarding filter.

Not built yet: user/team management UI (invite, roles, per-brand permission
toggles), receipt/bill photo upload to Supabase Storage, purchase bills
screen, statement (PDF/CSV) upload fallback importer, and a review queue UI
for `needs_review` auto-imported entries.

## Environment notes

The project lives on an SMB network share (`/Volumes/BackUp`), which matters:
- Turbopack's persistent cache cannot fsync there, so `.next/cache` is a
  symlink to `~/.dot-cashbook-cache`. If `.next` is ever deleted, recreate it:
  `mkdir -p .next && ln -sfn ~/.dot-cashbook-cache .next/cache`.
- `node_modules` must be a real directory in the project (npm replaces a
  symlink), so installs are slow but correct.

## Working agreement

- Keep this file and DEVLOG.md updated as decisions are made or features are
  added/changed, so any future session (any account) has full context just by
  opening this repo.
- Commit and push progress regularly so GitHub is always the source of truth.
