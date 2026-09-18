import { createClient } from "@/lib/supabase/server";
import { brandPermissions } from "@/lib/permissions";
import { RecurringView } from "@/components/recurring/recurring-view";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const [
    { data: entries },
    { data: accounts },
    { data: categories },
    { data: parties },
    { data: modes },
    { data: labels },
    perms,
  ] = await Promise.all([
    supabase.from("recurring_entries").select("*").eq("brand_id", brandId).order("next_due"),
    supabase.from("accounts").select("*").eq("brand_id", brandId).eq("is_active", true).order("sort_order"),
    supabase.from("categories").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("payment_modes").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("labels").select("*").eq("brand_id", brandId).order("name"),
    brandPermissions(supabase, brandId),
  ]);

  return (
    <RecurringView
      brandId={brandId}
      entries={entries ?? []}
      accounts={accounts ?? []}
      categories={categories ?? []}
      parties={parties ?? []}
      paymentModes={modes ?? []}
      labels={labels ?? []}
      canWrite={perms?.can_write ?? false}
    />
  );
}
