import { createClient } from "@/lib/supabase/server";
import { TransfersView } from "@/components/transfers/transfers-view";

export default async function TransfersPage() {
  const supabase = await createClient();

  const [{ data: brands }, { data: accounts }, { data: transfers }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order").order("name"),
    supabase.from("accounts").select("*").eq("is_active", true).order("sort_order"),
    supabase
      .from("transfers")
      .select("*")
      .order("transfer_date", { ascending: false })
      .limit(50),
  ]);

  return (
    <TransfersView
      brands={brands ?? []}
      accounts={accounts ?? []}
      transfers={transfers ?? []}
    />
  );
}
