import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatementImport } from "@/components/import/statement-import";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const [{ data: brand }, { data: accounts }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).single(),
    supabase.from("accounts").select("*").eq("brand_id", brandId).eq("is_active", true).order("sort_order"),
  ]);
  if (!brand) notFound();

  return <StatementImport brand={brand} accounts={accounts ?? []} />;
}
