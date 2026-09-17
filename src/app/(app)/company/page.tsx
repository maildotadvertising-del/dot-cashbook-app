import { createClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/team/team-view";
import type { Brand, BrandMember, Profile } from "@/lib/types";

export default async function CompanyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: company }, { data: brands }, { data: members }, { data: access }, { data: invites }] =
    await Promise.all([
      supabase.from("companies").select("*").limit(1).maybeSingle(),
      supabase.from("brands").select("*").order("sort_order").order("name"),
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("brand_members").select("*"),
      supabase
        .from("company_invites")
        .select("id, email, role, brand_ids, brand_role, created_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  const me = (members ?? []).find((m) => m.id === user?.id) as Profile | undefined;

  return (
    <TeamView
      companyName={company?.name ?? "Company"}
      currentUserId={user?.id ?? ""}
      canManage={me?.role === "owner" || me?.role === "admin"}
      brands={(brands ?? []) as Brand[]}
      members={(members ?? []) as Profile[]}
      access={(access ?? []) as BrandMember[]}
      invites={invites ?? []}
    />
  );
}
