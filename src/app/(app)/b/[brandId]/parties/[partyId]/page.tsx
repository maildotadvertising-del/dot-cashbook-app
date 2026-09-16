import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlassCard, PageHeader, Pill, StatCard } from "@/components/ui";
import { formatDate, money } from "@/lib/utils";

export default async function PartyPage({
  params,
}: {
  params: Promise<{ brandId: string; partyId: string }>;
}) {
  const { brandId, partyId } = await params;
  const supabase = await createClient();

  const { data: party } = await supabase
    .from("parties")
    .select("*")
    .eq("id", partyId)
    .single();
  if (!party) notFound();

  const [{ data: balance }, { data: transactions }, { data: documents }] = await Promise.all([
    supabase.from("party_balances").select("balance").eq("party_id", partyId).single(),
    supabase
      .from("transactions")
      .select("*, category:categories(name), account:accounts(name)")
      .eq("party_id", partyId)
      .order("txn_date", { ascending: false })
      .limit(50),
    supabase
      .from("documents")
      .select("*")
      .eq("party_id", partyId)
      .neq("doc_type", "quotation")
      .order("doc_date", { ascending: false })
      .limit(20),
  ]);

  const net = Number(balance?.balance ?? 0);
  const paid = (transactions ?? [])
    .filter((t) => t.direction === "in")
    .reduce((s, t) => s + Number(t.amount), 0);
  const spent = (transactions ?? [])
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/b/${brandId}/parties`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="size-4" /> Parties
      </Link>

      <PageHeader title={party.name} subtitle={party.type} />

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard
          label={net >= 0 ? "To collect" : "To pay"}
          value={Math.abs(net)}
          tone={net > 0 ? "in" : net < 0 ? "out" : "neutral"}
        />
        <StatCard label="Received" value={paid} tone="in" />
        <StatCard label="Paid" value={spent} tone="out" />
      </div>

      {(party.phone || party.email || party.address || party.gstin) && (
        <GlassCard className="mt-3 !p-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {party.phone && (
              <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                <Phone className="size-4" /> {party.phone}
              </div>
            )}
            {party.email && (
              <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                <Mail className="size-4" /> {party.email}
              </div>
            )}
            {party.gstin && (
              <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                <Receipt className="size-4" /> {party.gstin}
              </div>
            )}
            {party.address && (
              <div className="flex items-start gap-2 text-[var(--fg-muted)] sm:col-span-2">
                <MapPin className="size-4 shrink-0" /> {party.address}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {!!documents?.length && (
        <GlassCard className="mt-3">
          <h2 className="mb-3 text-sm font-semibold">Invoices &amp; bills</h2>
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {documents.map((d) => (
              <Link
                key={d.id}
                href={`/b/${brandId}/invoices/${d.id}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{d.doc_number}</span>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                    {formatDate(d.doc_date)}
                    <Pill
                      tone={
                        d.status === "paid" ? "in" : d.status === "cancelled" ? "neutral" : "warn"
                      }
                    >
                      {d.status}
                    </Pill>
                  </span>
                </span>
                <span className="money text-sm font-bold">₹{money(d.total)}</span>
              </Link>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="mt-3">
        <h2 className="mb-3 text-sm font-semibold">Cash book entries</h2>
        {!transactions?.length ? (
          <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No entries yet</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {transactions.map((t) => {
              const category = Array.isArray(t.category) ? t.category[0] : t.category;
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t.remark || category?.name || "Entry"}
                    </span>
                    <span className="block text-xs text-[var(--fg-muted)]">
                      {formatDate(t.txn_date)}
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
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
