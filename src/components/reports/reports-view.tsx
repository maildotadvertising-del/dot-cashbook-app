"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { Field, GlassCard, PageHeader, StatCard } from "@/components/ui";
import { exportSheets } from "@/lib/export";
import { cn, formatDate, money } from "@/lib/utils";
import type { Brand } from "@/lib/types";
import { Analytics, type AnalyticsData } from "@/components/reports/analytics";

interface CategoryRow {
  name: string;
  direction: "in" | "out";
  total: number;
}

interface GstRow {
  doc_number: string;
  doc_date: string;
  doc_type: string;
  party: string;
  gstin: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

const TABS = [
  { id: "analytics", label: "Analytics" },
  { id: "pl", label: "Profit & Loss" },
  { id: "cash", label: "Cash Flow" },
  { id: "parties", label: "Outstanding" },
  { id: "gst", label: "GST Summary" },
] as const;

export function ReportsView({
  brand,
  from,
  to,
  totals,
  categories,
  parties,
  gstDocs,
  balances,
  analytics,
}: {
  brand: Brand;
  from: string;
  to: string;
  totals: { in: number; out: number; net: number };
  categories: CategoryRow[];
  parties: { name: string; balance: number }[];
  gstDocs: GstRow[];
  balances: { name: string; balance: number }[];
  analytics: AnalyticsData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("analytics");

  function setRange(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const income = categories.filter((c) => c.direction === "in");
  const expense = categories.filter((c) => c.direction === "out");
  const receivables = parties.filter((p) => p.balance > 0);
  const payables = parties.filter((p) => p.balance < 0);

  const gstTotals = gstDocs.reduce(
    (acc, d) => ({
      taxable: acc.taxable + d.taxable,
      cgst: acc.cgst + d.cgst,
      sgst: acc.sgst + d.sgst,
      igst: acc.igst + d.igst,
      total: acc.total + d.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );

  function exportAll() {
    exportSheets(`${brand.name} reports ${from} to ${to}`, [
      {
        name: "Profit & Loss",
        rows: [
          ...income.map((c) => ({ Section: "Income", Category: c.name, Amount: c.total })),
          ...expense.map((c) => ({ Section: "Expense", Category: c.name, Amount: c.total })),
          { Section: "Net", Category: "", Amount: totals.net },
        ],
      },
      {
        name: "Cash Flow",
        rows: [
          { Item: "Cash In", Amount: totals.in },
          { Item: "Cash Out", Amount: totals.out },
          { Item: "Net", Amount: totals.net },
          ...balances.map((b) => ({ Item: `Closing — ${b.name}`, Amount: b.balance })),
        ],
      },
      {
        name: "Outstanding",
        rows: parties.map((p) => ({
          Party: p.name,
          Receivable: p.balance > 0 ? p.balance : 0,
          Payable: p.balance < 0 ? -p.balance : 0,
        })),
      },
      {
        name: "GST Summary",
        rows: gstDocs.map((d) => ({
          Number: d.doc_number,
          Date: d.doc_date,
          Type: d.doc_type,
          Party: d.party,
          GSTIN: d.gstin,
          Taxable: d.taxable,
          CGST: d.cgst,
          SGST: d.sgst,
          IGST: d.igst,
          Total: d.total,
        })),
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Reports"
        subtitle={`${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <>
            <button className="btn btn-ghost no-print" onClick={() => window.print()}>
              <Printer className="size-4" />
            </button>
            <button className="btn btn-accent no-print" onClick={exportAll}>
              <Download className="size-4" /> Export Excel
            </button>
          </>
        }
      />

      <GlassCard className="no-print !p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="From">
            <input
              className="field"
              type="date"
              value={from}
              onChange={(e) => setRange("from", e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              className="field"
              type="date"
              value={to}
              onChange={(e) => setRange("to", e.target.value)}
            />
          </Field>
          <div className="glass flex flex-wrap gap-1 rounded-full p-1">
            {TABS.map((option) => (
              <button
                key={option.id}
                onClick={() => setTab(option.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  tab === option.id ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Income" value={totals.in} tone="in" />
        <StatCard label="Expense" value={totals.out} tone="out" />
        <StatCard label="Net" value={totals.net} tone={totals.net >= 0 ? "in" : "out"} />
        <StatCard
          label="Closing balance"
          value={balances.reduce((s, b) => s + b.balance, 0)}
          tone="accent"
        />
      </div>

      <div className="mt-3">
        {tab === "analytics" && <Analytics data={analytics} />}

        {tab === "pl" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportTable
              title="Income"
              rows={income.map((c) => ({ label: c.name, value: c.total }))}
              total={totals.in}
              tone="in"
            />
            <ReportTable
              title="Expense"
              rows={expense.map((c) => ({ label: c.name, value: c.total }))}
              total={totals.out}
              tone="out"
            />
          </div>
        )}

        {tab === "cash" && (
          <GlassCard>
            <h2 className="mb-3 text-sm font-semibold">Cash flow</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <LineRow label="Cash in" value={totals.in} tone="in" />
              <LineRow label="Cash out" value={totals.out} tone="out" />
              <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-2 font-semibold">
                <dt>Net movement</dt>
                <dd className="money">₹{money(totals.net)}</dd>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                Closing balances
              </p>
              {balances.map((b) => (
                <LineRow key={b.name} label={b.name} value={b.balance} />
              ))}
            </dl>
          </GlassCard>
        )}

        {tab === "parties" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportTable
              title="Receivable"
              rows={receivables.map((p) => ({ label: p.name, value: p.balance }))}
              total={receivables.reduce((s, p) => s + p.balance, 0)}
              tone="in"
            />
            <ReportTable
              title="Payable"
              rows={payables.map((p) => ({ label: p.name, value: -p.balance }))}
              total={payables.reduce((s, p) => s - p.balance, 0)}
              tone="out"
            />
          </div>
        )}

        {tab === "gst" && (
          <GlassCard className="!p-0">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold">GST summary</h2>
              <span className="text-xs text-[var(--fg-muted)]">
                {gstDocs.length} documents
              </span>
            </div>
            {!gstDocs.length ? (
              <p className="px-4 pb-6 text-center text-sm text-[var(--fg-muted)]">
                No GST documents in this period
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-y border-[var(--hairline)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                      <th className="px-4 py-2.5 font-semibold">Number</th>
                      <th className="px-4 py-2.5 font-semibold">Party</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Taxable</th>
                      <th className="px-4 py-2.5 text-right font-semibold">CGST</th>
                      <th className="px-4 py-2.5 text-right font-semibold">SGST</th>
                      <th className="px-4 py-2.5 text-right font-semibold">IGST</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstDocs.map((d) => (
                      <tr key={d.doc_number} className="border-b border-[var(--hairline)]">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{d.doc_number}</div>
                          <div className="text-xs text-[var(--fg-muted)]">
                            {formatDate(d.doc_date)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div>{d.party}</div>
                          <div className="text-xs text-[var(--fg-muted)]">{d.gstin}</div>
                        </td>
                        <td className="money px-4 py-2.5 text-right">₹{money(d.taxable)}</td>
                        <td className="money px-4 py-2.5 text-right">₹{money(d.cgst)}</td>
                        <td className="money px-4 py-2.5 text-right">₹{money(d.sgst)}</td>
                        <td className="money px-4 py-2.5 text-right">₹{money(d.igst)}</td>
                        <td className="money px-4 py-2.5 text-right font-semibold">
                          ₹{money(d.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="px-4 py-2.5" colSpan={2}>
                        Total
                      </td>
                      <td className="money px-4 py-2.5 text-right">₹{money(gstTotals.taxable)}</td>
                      <td className="money px-4 py-2.5 text-right">₹{money(gstTotals.cgst)}</td>
                      <td className="money px-4 py-2.5 text-right">₹{money(gstTotals.sgst)}</td>
                      <td className="money px-4 py-2.5 text-right">₹{money(gstTotals.igst)}</td>
                      <td className="money px-4 py-2.5 text-right">₹{money(gstTotals.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}

function ReportTable({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { label: string; value: number }[];
  total: number;
  tone: "in" | "out";
}) {
  return (
    <GlassCard>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {!rows.length ? (
        <p className="py-5 text-center text-sm text-[var(--fg-muted)]">Nothing in this period</p>
      ) : (
        <dl className="flex flex-col gap-1.5 text-sm">
          {rows.map((row) => (
            <LineRow key={row.label} label={row.label} value={row.value} />
          ))}
          <div className="mt-1 flex items-center justify-between border-t border-[var(--hairline)] pt-2 font-semibold">
            <dt>Total</dt>
            <dd
              className={`money ${tone === "in" ? "text-[var(--in)]" : "text-[var(--out)]"}`}
            >
              ₹{money(total)}
            </dd>
          </div>
        </dl>
      )}
    </GlassCard>
  );
}

function LineRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "in" | "out";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="min-w-0 truncate pr-3 text-[var(--fg-muted)]">{label}</dt>
      <dd
        className={cn(
          "money",
          tone === "in" && "text-[var(--in)]",
          tone === "out" && "text-[var(--out)]",
        )}
      >
        ₹{money(value)}
      </dd>
    </div>
  );
}
