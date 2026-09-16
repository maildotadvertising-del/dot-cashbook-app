import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportsView } from "@/components/reports/reports-view";

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(now) };
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { brandId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  const fallback = defaultRange();
  const from = sp.from || fallback.from;
  const to = sp.to || fallback.to;

  const [
    { data: summary },
    { data: categories },
    { data: partyBalances },
    { data: gstDocs },
    { data: balances },
  ] = await Promise.all([
    supabase.rpc("ledger_summary", {
      target_brand: brandId,
      from_date: from,
      to_date: to,
      account: null,
    }),
    supabase.rpc("category_totals", {
      target_brand: brandId,
      from_date: from,
      to_date: to,
    }),
    supabase.from("party_balances").select("*").eq("brand_id", brandId),
    supabase
      .from("documents")
      .select("doc_number, doc_date, doc_type, is_gst, subtotal, cgst, sgst, igst, total, party:parties(name, gstin)")
      .eq("brand_id", brandId)
      .eq("is_gst", true)
      .neq("status", "draft")
      .neq("status", "cancelled")
      .gte("doc_date", from)
      .lte("doc_date", to)
      .order("doc_date"),
    supabase.from("account_balances").select("*").eq("brand_id", brandId),
  ]);

  const totals = summary?.[0] ?? { total_in: 0, total_out: 0, net: 0 };

  return (
    <ReportsView
      brand={brand}
      from={from}
      to={to}
      totals={{
        in: Number(totals.total_in),
        out: Number(totals.total_out),
        net: Number(totals.net),
      }}
      categories={(categories ?? []).map(
        (c: { category_name: string; direction: string; total: number }) => ({
          name: c.category_name,
          direction: c.direction as "in" | "out",
          total: Number(c.total),
        }),
      )}
      parties={(partyBalances ?? []).map((p) => ({
        name: p.name as string,
        balance: Number(p.balance),
      }))}
      gstDocs={(gstDocs ?? []).map((d) => {
        const party = (Array.isArray(d.party) ? d.party[0] : d.party) as
          | { name: string | null; gstin: string | null }
          | null
          | undefined;
        return {
          doc_number: d.doc_number,
          doc_date: d.doc_date,
          doc_type: d.doc_type,
          party: party?.name ?? "",
          gstin: party?.gstin ?? "",
          taxable: Number(d.subtotal),
          cgst: Number(d.cgst),
          sgst: Number(d.sgst),
          igst: Number(d.igst),
          total: Number(d.total),
        };
      })}
      balances={(balances ?? []).map((b) => ({
        name: b.name as string,
        balance: Number(b.balance),
      }))}
    />
  );
}
