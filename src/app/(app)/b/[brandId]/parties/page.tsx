import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartiesView } from "@/components/parties/parties-view";

export default async function PartiesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  const [{ data: parties }, { data: balances }] = await Promise.all([
    supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("party_balances").select("*").eq("brand_id", brandId),
  ]);

  const balanceById = new Map(
    (balances ?? []).map((b) => [b.party_id as string, Number(b.balance)]),
  );

  return (
    <PartiesView
      brand={brand}
      parties={(parties ?? []).map((p) => ({ ...p, balance: balanceById.get(p.id) ?? 0 }))}
    />
  );
}
