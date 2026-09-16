import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ItemsView } from "@/components/items/items-view";

export default async function ItemsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("brand_id", brandId)
    .order("name");

  return <ItemsView brand={brand} items={items ?? []} />;
}
