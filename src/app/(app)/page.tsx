import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: brands } = await supabase
    .from("brands")
    .select("id")
    .order("sort_order")
    .order("name")
    .limit(1);

  if (!brands?.length) redirect("/company/brands/new");
  redirect(`/b/${brands[0].id}/dashboard`);
}
