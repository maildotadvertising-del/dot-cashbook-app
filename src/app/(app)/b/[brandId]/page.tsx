import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brandPermissions } from "@/lib/permissions";

export default async function BrandHome({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const perms = await brandPermissions(await createClient(), brandId);
  redirect(`/b/${brandId}/${perms?.can_reports ? "dashboard" : "cashbook"}`);
}
