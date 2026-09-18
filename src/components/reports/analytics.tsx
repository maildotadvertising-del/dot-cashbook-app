"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/ui";
import { cn, money, moneyShort } from "@/lib/utils";

export interface AnalyticsData {
  categories: { name: string; direction: "in" | "out"; total: number }[];
  labels: { name: string; color: string; direction: "in" | "out"; total: number }[];
  payees: { payee: string; direction: "in" | "out"; total: number; entries: number }[];
  months: { month: string; in: number; out: number }[];
}

// Theme accents only (DOT-Team-App-THEME.md); slices past five reuse them.
const PALETTE = ["#0A84FF", "#BF5FFF", "#FF9F0A", "#30D158", "#FF453A"];

const tooltipStyle = {
  background: "#1A1A2E",
  border: "0.5px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  fontSize: 12,
  color: "#F5F5F7",
};

const axisTick = { fontSize: 11, fill: "rgba(245,245,247,0.45)" };

/** Keeps the biggest slices and folds the long tail into "Other". */
function topWithOther<T extends { total: number }>(rows: T[], keep: number, make: (total: number) => T) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (sorted.length <= keep) return sorted;
  const rest = sorted.slice(keep).reduce((s, r) => s + r.total, 0);
  return [...sorted.slice(0, keep), make(rest)];
}

export function Analytics({ data }: { data: AnalyticsData }) {
  const spend = topWithOther(
    data.categories.filter((c) => c.direction === "out"),
    6,
    (total) => ({ name: "Other", direction: "out" as const, total }),
  );
  const spendTotal = spend.reduce((s, c) => s + c.total, 0);

  const labelOut = data.labels.filter((l) => l.direction === "out").slice(0, 8);
  const labelIn = data.labels.filter((l) => l.direction === "in").slice(0, 8);
  const payeesOut = data.payees.filter((p) => p.direction === "out").slice(0, 8);
  const payeesIn = data.payees.filter((p) => p.direction === "in").slice(0, 8);

  const months = data.months.map((m) => ({
    ...m,
    label: new Date(m.month).toLocaleDateString("en-IN", { month: "short" }),
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <GlassCard>
        <h2 className="mb-1 text-sm font-medium">Last 6 months</h2>
        <p className="mb-3 text-[11px] text-[var(--fg-muted)]">Money in vs out, transfers between own accounts excluded</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 4, right: 4, left: -14, bottom: 0 }} barGap={3}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => moneyShort(v)} tick={axisTick} tickLine={false} axisLine={false} width={58} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={tooltipStyle}
                formatter={(value, name) => [`₹${money(Number(value))}`, name === "in" ? "In" : "Out"]}
              />
              <Bar dataKey="in" fill="#30D158" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="out" fill="#FF453A" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="mb-1 text-sm font-medium">Where the money went</h2>
        <p className="mb-3 text-[11px] text-[var(--fg-muted)]">Expense by category for the selected dates</p>
        {!spend.length ? (
          <p className="py-10 text-center text-sm text-[var(--fg-muted)]">No expenses in this period</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative size-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spend} dataKey="total" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {spend.map((row, i) => (
                      <Cell key={row.name} fill={row.name === "Other" ? "rgba(245,245,247,0.2)" : PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => `₹${money(Number(value))}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <span>
                  <span className="label-caps block">Spent</span>
                  <span className="money text-sm">₹{moneyShort(spendTotal)}</span>
                </span>
              </div>
            </div>
            <ul className="flex w-full flex-col gap-1.5 text-[13px]">
              {spend.map((row, i) => (
                <li key={row.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: row.name === "Other" ? "rgba(245,245,247,0.2)" : PALETTE[i % PALETTE.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate font-light">{row.name}</span>
                  <span className="money text-[var(--fg-muted)]">{((row.total / spendTotal) * 100).toFixed(0)}%</span>
                  <span className="money w-24 text-right">₹{money(row.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>

      <RankCard
        title="Spend by label"
        empty="No labelled expenses — add labels to entries or rules"
        rows={labelOut.map((l) => ({ name: l.name, total: l.total, color: l.color }))}
      />
      <RankCard
        title="Income by label"
        empty="No labelled income in this period"
        rows={labelIn.map((l) => ({ name: l.name, total: l.total, color: l.color }))}
      />
      <RankCard
        title="Top payees"
        empty="No payments in this period"
        rows={payeesOut.map((p) => ({ name: p.payee, total: p.total, hint: `${p.entries} entries`, color: "#FF453A" }))}
      />
      <RankCard
        title="Top payers"
        empty="No receipts in this period"
        rows={payeesIn.map((p) => ({ name: p.payee, total: p.total, hint: `${p.entries} entries`, color: "#30D158" }))}
      />
    </div>
  );
}

function RankCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { name: string; total: number; color: string; hint?: string }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <GlassCard>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {!rows.length ? (
        <p className="py-6 text-center text-[13px] text-[var(--fg-muted)]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.name}>
              <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-light">{row.name}</span>
                {row.hint && <span className="text-[11px] text-[var(--fg-subtle)]">{row.hint}</span>}
                <span className="money">₹{money(row.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn("h-full rounded-full")}
                  style={{ width: `${Math.max(3, (row.total / max) * 100)}%`, background: row.color, opacity: 0.85 }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
