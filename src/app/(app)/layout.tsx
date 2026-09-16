import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
import type { Brand, Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: brands }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("brands").select("*").order("sort_order").order("name"),
  ]);

  return (
    <Shell
      profile={profile as Profile | null}
      brands={(brands ?? []) as Brand[]}
      email={user.email ?? ""}
    >
      {children}
    </Shell>
  );
}
