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
9. **UPI/bank auto-capture (semi-automatic)** — user uploads bank/UPI
   statement (PDF/CSV) periodically; app parses and bulk-imports transactions
   as in/out entries, extracting the UPI note/description automatically into
   each entry. (Real-time notification/SMS reading is not used: iOS never
   allows any app to read another app's notifications/SMS, and this is a web
   app so the Android-only Notification Listener approach is also out —
   statement upload/parse is the cross-platform approach.)
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
- No real-time UPI notification capture — technically impossible on iOS for
  any app, and out of scope for a web app on Android too. Statement
  upload+parse instead.
- "MCP Connection settings" = a normal integrations settings page, not a
  literal Model Context Protocol server connection.

## Status

Planning complete for the items above. Build has **not started yet** — the
user has more requirements to share before implementation begins. Do not
scaffold the Next.js project until the user explicitly says to start building.

## Working agreement

- Keep this file and DEVLOG.md updated as decisions are made or features are
  added/changed, so any future session (any account) has full context just by
  opening this repo.
- Commit and push progress regularly so GitHub is always the source of truth.
