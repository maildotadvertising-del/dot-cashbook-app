import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  const [{ data: accounts }, { data: categories }, { data: modes }, { data: inbound }, { data: imports }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("brand_id", brandId).order("sort_order"),
      supabase.from("categories").select("*").eq("brand_id", brandId).order("name"),
      supabase.from("payment_modes").select("*").eq("brand_id", brandId).order("name"),
      supabase.from("inbound_addresses").select("*").eq("brand_id", brandId),
      supabase
        .from("email_imports")
        .select("id, subject, status, received_at, error")
        .eq("brand_id", brandId)
        .order("received_at", { ascending: false })
        .limit(10),
    ]);

  return (
    <SettingsView
      brand={brand}
      accounts={accounts ?? []}
      categories={categories ?? []}
      paymentModes={modes ?? []}
      inbound={inbound ?? []}
      recentImports={imports ?? []}
    />
  );
}
