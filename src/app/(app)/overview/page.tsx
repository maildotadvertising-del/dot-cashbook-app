import Link from "next/link";
import { ArrowUpRight, Plus, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, GlassCard, PageHeader, StatCard } from "@/components/ui";
import { money } from "@/lib/utils";

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: brands }, { data: brandBalances }, { data: partyBalances }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order").order("name"),
    supabase.from("brand_balances").select("*"),
    supabase.from("party_balances").select("brand_id, balance"),
  ]);

  const summaries = await Promise.all(
    (brands ?? []).map(async (brand) => {
      const { data } = await supabase.rpc("ledger_summary", {
        target_brand: brand.id,
        from_date: from,
        to_date: to,
        account: null,
      });
      const row = data?.[0] ?? { total_in: 0, total_out: 0, net: 0 };
      return {
        brandId: brand.id,
        in: Number(row.total_in),
        out: Number(row.total_out),
      };
    }),
  );

  const balanceFor = (id: string) =>
    Number((brandBalances ?? []).find((b) => b.brand_id === id)?.balance ?? 0);
  const summaryFor = (id: string) =>
    summaries.find((s) => s.brandId === id) ?? { in: 0, out: 0 };

  const totalOnHand = (brandBalances ?? []).reduce((sum, b) => sum + Number(b.balance), 0);
  const totalIn = summaries.reduce((sum, s) => sum + s.in, 0);
  const totalOut = summaries.reduce((sum, s) => sum + s.out, 0);
  const receivable = (partyBalances ?? [])
    .filter((p) => Number(p.balance) > 0)
    .reduce((sum, p) => sum + Number(p.balance), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="All Brands"
        subtitle="Everything across the company, this month"
        actions={
          <Link href="/company/brands/new" className="btn btn-accent">
            <Plus className="size-4" /> Add brand
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total on hand" value={totalOnHand} tone="accent" />
        <StatCard label="Cash in" value={totalIn} tone="in" />
        <StatCard label="Cash out" value={totalOut} tone="out" />
        <StatCard label="Receivable" value={receivable} />
      </div>

      <div className="mt-3">
        {!brands?.length ? (
          <GlassCard>
            <EmptyState
              icon={<Wallet className="size-9" />}
              title="No brands yet"
              description="Add your first brand to start keeping its cash book."
              action={
                <Link href="/company/brands/new" className="btn btn-accent">
                  <Plus className="size-4" /> Add brand
                </Link>
              }
            />
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {brands.map((brand) => {
              const summary = summaryFor(brand.id);
              return (
                <Link
                  key={brand.id}
                  href={`/b/${brand.id}/dashboard`}
                  className="glass glass-hover card rise"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{brand.name}</h2>
                      <p className="truncate text-xs text-[var(--fg-muted)]">
                        {brand.gstin ?? "No GSTIN"}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-[var(--fg-muted)]" />
                  </div>

                  <div className="money mt-3 text-2xl font-bold">
                    ₹{money(balanceFor(brand.id))}
                  </div>
                  <p className="text-xs text-[var(--fg-muted)]">on hand</p>

                  <div className="mt-3 flex gap-4 border-t border-[var(--hairline)] pt-3 text-sm">
                    <span>
                      <span className="block text-[11px] text-[var(--fg-muted)]">In</span>
                      <span className="money font-semibold text-[var(--in)]">
                        ₹{money(summary.in)}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[11px] text-[var(--fg-muted)]">Out</span>
                      <span className="money font-semibold text-[var(--out)]">
                        ₹{money(summary.out)}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
