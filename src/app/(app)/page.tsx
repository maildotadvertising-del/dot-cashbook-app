import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allBrandPermissions } from "@/lib/permissions";

export default async function Home() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .order("sort_order")
    .order("name")
    .limit(1);

  if (!brands?.length) redirect("/company");

  const perms = (await allBrandPermissions(supabase)).find((p) => p.brand_id === brands[0].id);
  redirect(`/b/${brands[0].id}/${perms?.can_reports ? "dashboard" : "cashbook"}`);
}
