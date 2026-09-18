"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { EntryModal } from "@/components/cashbook/entry-modal";
import { Combo } from "@/components/combo";
import { EmptyState, Field, GlassCard, PageHeader, Pill, StatCard } from "@/components/ui";
import { cn, formatDate, money } from "@/lib/utils";
import { exportRows } from "@/lib/export";
import type {
  Account,
  Brand,
  Category,
  Direction,
  PaymentMode,
  Party,
  TransactionRow,
} from "@/lib/types";

interface BalanceRow {
  account_id: string;
  name: string;
  type: string;
  balance: number;
}

export function Ledger({
  brand,
  transactions,
  total,
  page,
  pageSize,
  accounts,
  categories,
  paymentModes,
  parties,
  totals,
  balances,
  canWrite,
  canManage,
  showBalances,
}: {
  brand: Brand;
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  accounts: Account[];
  categories: Category[];
  paymentModes: PaymentMode[];
  parties: Party[];
  totals: { in: number; out: number; net: number };
  balances: BalanceRow[];
  canWrite: boolean;
  canManage: boolean;
  showBalances: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("in");
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(params.get("q") ?? "");

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = ["from", "to", "dir", "account", "party", "category", "mode"].filter(
    (key) => params.get(key),
  ).length;

  function setParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in updates)) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function openNew(dir: Direction) {
    setEditing(null);
    setDirection(dir);
    setModalOpen(true);
  }

  function exportLedger() {
    exportRows(
      `${brand.name} cashbook`,
      transactions.map((t) => ({
        Date: t.txn_date,
        Type: t.direction === "in" ? "Cash In" : "Cash Out",
        Remark: t.remark ?? "",
        Party: t.party?.name ?? "",
        Category: t.category?.name ?? "",
        Mode: t.payment_mode?.name ?? "",
        Account: t.account?.name ?? "",
        "Cash In": t.direction === "in" ? Number(t.amount) : "",
        "Cash Out": t.direction === "out" ? Number(t.amount) : "",
      })),
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Cash Book"
        subtitle={brand.name}
        actions={
          <>
            {canManage && (
              <Link href={`/b/${brand.id}/import`} className="btn btn-ghost">
                <Upload className="size-4" />
                <span className="hidden sm:inline">Import</span>
              </Link>
            )}
            <button className="btn btn-ghost" onClick={exportLedger}>
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            {canWrite && (
              <>
                <button className="btn btn-in" onClick={() => openNew("in")}>
                  <Plus className="size-4" /> Cash In
                </button>
                <button className="btn btn-out" onClick={() => openNew("out")}>
                  <Minus className="size-4" /> Cash Out
                </button>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cash In" value={totals.in} tone="in" />
        <StatCard label="Cash Out" value={totals.out} tone="out" />
        {showBalances && (
          <>
            <StatCard
              label="Net Balance"
              value={totals.net}
              tone={totals.net >= 0 ? "accent" : "out"}
            />
            <StatCard
              label="On Hand"
              value={balances.reduce((sum, b) => sum + Number(b.balance), 0)}
              hint={balances.map((b) => `${b.name} ₹${money(b.balance)}`).join(" · ")}
              icon={<Wallet className="size-3.5" />}
            />
          </>
        )}
      </div>

      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              className="field !pl-9"
              placeholder="Search remark or party…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setParam({ q: search || null })}
            />
          </div>
          <button
            className={cn("btn btn-ghost", activeFilters && "!text-[var(--accent)]")}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilters > 0 && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-[11px] text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-[var(--hairline)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="From">
              <input
                className="field"
                type="date"
                value={params.get("from") ?? ""}
                onChange={(e) => setParam({ from: e.target.value || null })}
              />
            </Field>
            <Field label="To">
              <input
                className="field"
                type="date"
                value={params.get("to") ?? ""}
                onChange={(e) => setParam({ to: e.target.value || null })}
              />
            </Field>
            <Field label="Type">
              <Combo
                options={[
                  { id: "in", label: "Cash In" },
                  { id: "out", label: "Cash Out" },
                ]}
                value={params.get("dir")}
                onChange={(v) => setParam({ dir: v })}
                placeholder="All types"
              />
            </Field>
            <Field label="Account">
              <Combo
                options={accounts.map((a) => ({ id: a.id, label: a.name }))}
                value={params.get("account")}
                onChange={(v) => setParam({ account: v })}
                placeholder="All accounts"
              />
            </Field>
            <Field label="Party">
              <Combo
                options={parties.map((p) => ({ id: p.id, label: p.name }))}
                value={params.get("party")}
                onChange={(v) => setParam({ party: v })}
                placeholder="All parties"
              />
            </Field>
            <Field label="Category">
              <Combo
                options={categories.map((c) => ({ id: c.id, label: c.name }))}
                value={params.get("category")}
                onChange={(v) => setParam({ category: v })}
                placeholder="All categories"
              />
            </Field>

            {activeFilters > 0 && (
              <button
                className="btn btn-ghost justify-self-start"
                onClick={() =>
                  setParam({
                    from: null, to: null, dir: null, account: null,
                    party: null, category: null, mode: null, q: null,
                  })
                }
              >
                <X className="size-4" /> Clear filters
              </button>
            )}
          </div>
        )}
      </GlassCard>

      <div className={cn("mt-4", pending && "opacity-60")}>
        {transactions.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon={<Wallet className="size-9" />}
              title="No entries yet"
              description="Add your first Cash In or Cash Out entry to start the book."
              action={
                canWrite && (
                  <button className="btn btn-in" onClick={() => openNew("in")}>
                    <Plus className="size-4" /> Add Cash In
                  </button>
                )
              }
            />
          </GlassCard>
        ) : (
          <>
            {/* mobile list */}
            <div className="flex flex-col gap-2 lg:hidden">
              {transactions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setEditing(t);
                    setModalOpen(true);
                  }}
                  className="glass glass-hover card rise flex items-center gap-3 !p-3 text-left"
                >
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      t.direction === "in"
                        ? "bg-[var(--in-soft)] text-[var(--in)]"
                        : "bg-[var(--out-soft)] text-[var(--out)]",
                    )}
                  >
                    {t.direction === "in" ? <Plus className="size-4" /> : <Minus className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t.remark || t.party?.name || t.category?.name || "Entry"}
                    </span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {formatDate(t.txn_date)}
                      {t.category?.name ? ` · ${t.category.name}` : ""}
                      {t.payment_mode?.name ? ` · ${t.payment_mode.name}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "money shrink-0 text-sm font-bold",
                      t.direction === "in" ? "text-[var(--in)]" : "text-[var(--out)]",
                    )}
                  >
                    ₹{money(t.amount)}
                  </span>
                </button>
              ))}
            </div>

            {/* desktop table */}
            <GlassCard className="hidden !p-0 lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--hairline)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Mode</th>
                    <th className="px-4 py-3 text-right font-semibold">Cash In</th>
                    <th className="px-4 py-3 text-right font-semibold">Cash Out</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                      className="cursor-pointer border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--accent-soft)]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--fg-muted)]">
                        {formatDate(t.txn_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.remark || "—"}</div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                          {t.party?.name && <span>{t.party.name}</span>}
                          {t.source === "email" && <Pill tone="accent">auto</Pill>}
                          {t.source === "transfer" && <Pill tone="accent">transfer</Pill>}
                          {t.needs_review && <Pill tone="warn">review</Pill>}
                          {t.bill_url && <Paperclip className="size-3.5" aria-label="Bill attached" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{t.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{t.payment_mode?.name ?? "—"}</td>
                      <td className="money px-4 py-3 text-right font-semibold text-[var(--in)]">
                        {t.direction === "in" ? `₹${money(t.amount)}` : ""}
                      </td>
                      <td className="money px-4 py-3 text-right font-semibold text-[var(--out)]">
                        {t.direction === "out" ? `₹${money(t.amount)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>

            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--fg-muted)]">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost !px-3"
                    disabled={page <= 1}
                    onClick={() => setParam({ page: String(page - 1) })}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    className="btn btn-ghost !px-3"
                    disabled={page >= pageCount}
                    onClick={() => setParam({ page: String(page + 1) })}
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <EntryModal
        key={modalOpen ? (editing?.id ?? `new-${direction}`) : "closed"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        brandId={brand.id}
        direction={direction}
        entry={editing}
        accounts={accounts}
        categories={categories}
        parties={parties}
        paymentModes={paymentModes}
      />
    </div>
  );
}
