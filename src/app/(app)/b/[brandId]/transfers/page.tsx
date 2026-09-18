import { createClient } from "@/lib/supabase/server";
import { TransfersView } from "@/components/transfers/transfers-view";

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const [{ data: brands }, { data: accounts }, { data: transfers }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order").order("name"),
    supabase.from("accounts").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transfers")
      .select("*")
      .or(`from_brand_id.eq.${brandId},to_brand_id.eq.${brandId}`)
      .order("transfer_date", { ascending: false })
      .limit(50),
  ]);

  return (
    <TransfersView
      brandId={brandId}
      brands={brands ?? []}
      accounts={accounts ?? []}
      transfers={transfers ?? []}
    />
  );
}
