import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brandPermissions } from "@/lib/permissions";
import { GlassCard, PageHeader, Pill, StatCard } from "@/components/ui";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { formatDate, money } from "@/lib/utils";
import type { TransactionRow } from "@/lib/types";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(now) };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { start, end } = monthRange();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  if (!(await brandPermissions(supabase, brandId))?.can_reports) {
    redirect(`/b/${brandId}/cashbook`);
  }

  const chartStart = new Date();
  chartStart.setDate(chartStart.getDate() - 29);

  const [
    { data: balances },
    { data: monthSummary },
    { data: daily },
    { data: recent },
    { data: partyBalances },
    { data: openDocs },
  ] = await Promise.all([
    supabase.from("account_balances").select("*").eq("brand_id", brandId),
    supabase.rpc("ledger_summary", {
      target_brand: brandId,
      from_date: start,
      to_date: end,
      account: null,
    }),
    supabase.rpc("daily_totals", {
      target_brand: brandId,
      from_date: chartStart.toISOString().slice(0, 10),
      to_date: end,
    }),
    supabase
      .from("transactions")
      .select(
        `*, party:parties(id, name, type), category:categories(id, name),
         payment_mode:payment_modes(id, name), account:accounts(id, name, type)`,
      )
      .eq("brand_id", brandId)
      .order("txn_date", { ascending: false })
      .order("txn_at", { ascending: false })
      .limit(6),
    supabase.from("party_balances").select("*").eq("brand_id", brandId),
    supabase
      .from("documents")
      .select("id, doc_type, doc_number, total, amount_paid, due_date, status, party:parties(name)")
      .eq("brand_id", brandId)
      .eq("doc_type", "invoice")
      .in("status", ["sent", "partial"])
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  const month = monthSummary?.[0] ?? { total_in: 0, total_out: 0, net: 0 };
  const onHand = (balances ?? []).reduce((sum, b) => sum + Number(b.balance), 0);
  const receivable = (partyBalances ?? [])
    .filter((p) => Number(p.balance) > 0)
    .reduce((sum, p) => sum + Number(p.balance), 0);
  const payable = (partyBalances ?? [])
    .filter((p) => Number(p.balance) < 0)
    .reduce((sum, p) => sum - Number(p.balance), 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle={brand.name}
        actions={
          <Link href={`/b/${brandId}/cashbook`} className="btn btn-accent">
            <Plus className="size-4" /> New entry
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On Hand" value={onHand} tone="accent" hint="Across all accounts" />
        <StatCard label="This Month In" value={Number(month.total_in)} tone="in" />
        <StatCard label="This Month Out" value={Number(month.total_out)} tone="out" />
        <StatCard
          label="Net (month)"
          value={Number(month.net)}
          tone={Number(month.net) >= 0 ? "in" : "out"}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Last 30 days</h2>
          <CashflowChart
            data={(daily ?? []).map((d: { day: string; total_in: number; total_out: number }) => ({
              day: d.day,
              in: Number(d.total_in),
              out: Number(d.total_out),
            }))}
          />
        </GlassCard>

        <div className="flex flex-col gap-3">
          <StatCard label="Receivable" value={receivable} tone="in" hint="Customers owe you" />
          <StatCard label="Payable" value={payable} tone="out" hint="You owe suppliers" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent entries</h2>
            <Link
              href={`/b/${brandId}/cashbook`}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {!recent?.length ? (
            <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No entries yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--hairline)]">
              {(recent as TransactionRow[]).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t.remark || t.party?.name || "Entry"}
                    </span>
                    <span className="block text-xs text-[var(--fg-muted)]">
                      {formatDate(t.txn_date)}
                      {t.category?.name ? ` · ${t.category.name}` : ""}
                    </span>
                  </span>
                  <span
                    className={`money text-sm font-bold ${
                      t.direction === "in" ? "text-[var(--in)]" : "text-[var(--out)]"
                    }`}
                  >
                    {t.direction === "in" ? "+" : "−"}₹{money(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Unpaid invoices</h2>
            <Link
              href={`/b/${brandId}/invoices`}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {!openDocs?.length ? (
            <p className="py-6 text-center text-sm text-[var(--fg-muted)]">
              Nothing outstanding
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--hairline)]">
              {openDocs.map((d) => {
                const overdue = d.due_date && d.due_date < today;
                const party = Array.isArray(d.party) ? d.party[0] : d.party;
                return (
                  <Link
                    key={d.id}
                    href={`/b/${brandId}/invoices/${d.id}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {party?.name ?? "—"}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                        {d.doc_number}
                        {overdue && <Pill tone="out">overdue</Pill>}
                      </span>
                    </span>
                    <span className="money text-sm font-bold">
                      ₹{money(Number(d.total) - Number(d.amount_paid))}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
