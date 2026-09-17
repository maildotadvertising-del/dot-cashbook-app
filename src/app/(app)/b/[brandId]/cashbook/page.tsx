import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandPermissions } from "@/lib/permissions";
import { Ledger } from "@/components/cashbook/ledger";

const PAGE_SIZE = 50;

export default async function CashbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { brandId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();
  if (!brand) notFound();

  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from || null;
  const to = sp.to || null;

  let query = supabase
    .from("transactions")
    .select(
      `*,
       party:parties(id, name, type),
       category:categories(id, name),
       payment_mode:payment_modes(id, name),
       account:accounts(id, name, type)`,
      { count: "exact" },
    )
    .eq("brand_id", brandId)
    .order("txn_date", { ascending: false })
    .order("txn_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (from) query = query.gte("txn_date", from);
  if (to) query = query.lte("txn_date", to);
  if (sp.dir === "in" || sp.dir === "out") query = query.eq("direction", sp.dir);
  if (sp.account) query = query.eq("account_id", sp.account);
  if (sp.party) query = query.eq("party_id", sp.party);
  if (sp.category) query = query.eq("category_id", sp.category);
  if (sp.mode) query = query.eq("payment_mode_id", sp.mode);
  if (sp.q) query = query.or(`remark.ilike.%${sp.q}%,counterparty.ilike.%${sp.q}%`);

  const [
    { data: transactions, count },
    { data: accounts },
    { data: categories },
    { data: modes },
    { data: parties },
    { data: summary },
    { data: balances },
    perms,
  ] = await Promise.all([
    query,
    supabase.from("accounts").select("*").eq("brand_id", brandId).order("sort_order"),
    supabase.from("categories").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("payment_modes").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
    supabase.rpc("ledger_summary", {
      target_brand: brandId,
      from_date: from,
      to_date: to,
      account: sp.account ?? null,
    }),
    supabase.from("account_balances").select("*").eq("brand_id", brandId),
    brandPermissions(supabase, brandId),
  ]);

  const totals = summary?.[0] ?? { total_in: 0, total_out: 0, net: 0 };

  return (
    <Ledger
      brand={brand}
      transactions={transactions ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      accounts={accounts ?? []}
      categories={categories ?? []}
      paymentModes={modes ?? []}
      parties={parties ?? []}
      totals={{
        in: Number(totals.total_in),
        out: Number(totals.total_out),
        net: Number(totals.net),
      }}
      balances={balances ?? []}
      canWrite={perms?.can_write ?? false}
      canManage={perms?.can_manage ?? false}
      showBalances={perms?.can_reports ?? false}
    />
  );
}
