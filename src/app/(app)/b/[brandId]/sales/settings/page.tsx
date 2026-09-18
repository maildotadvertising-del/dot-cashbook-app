import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandPermissions } from "@/lib/permissions";
import { SalesSettings } from "@/components/settings/workspace-settings";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const [{ data: brand }, perms] = await Promise.all([
    supabase.from("brands").select("*").eq("id", brandId).single(),
    brandPermissions(supabase, brandId),
  ]);
  if (!brand) notFound();
  if (!perms?.can_manage) redirect(`/b/${brandId}`);

  return <SalesSettings brand={brand} />;
}
