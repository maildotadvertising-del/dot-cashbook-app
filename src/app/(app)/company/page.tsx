import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlassCard, PageHeader, Pill } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function CompanyPage() {
  const supabase = await createClient();

  const [{ data: company }, { data: brands }, { data: members }] = await Promise.all([
    supabase.from("companies").select("*").limit(1).maybeSingle(),
    supabase.from("brands").select("*").order("sort_order").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={company?.name ?? "Company"}
        subtitle={`${brands?.length ?? 0} brands · ${members?.length ?? 0} people`}
      />

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Brands</h2>
          <Link href="/company/brands/new" className="btn btn-ghost !px-3 !py-1.5">
            <Plus className="size-4" /> Add
          </Link>
        </div>

        {!brands?.length ? (
          <p className="py-5 text-center text-sm text-[var(--fg-muted)]">No brands yet</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/b/${brand.id}/settings`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                  {initials(brand.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{brand.name}</span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">
                    {brand.gstin ?? "No GSTIN"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="mt-3">
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold">People</h2>
        </div>

        {!members?.length ? (
          <p className="py-5 text-center text-sm text-[var(--fg-muted)]">No one here yet</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                  {initials(member.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.full_name ?? "Unnamed"}
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">
                    {member.phone ?? ""}
                  </span>
                </span>
                <Pill tone={member.role === "owner" ? "accent" : "neutral"}>{member.role}</Pill>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          People join by signing up with their email — they land as staff, and you can raise them
          to admin here once user management ships.
        </p>
      </GlassCard>
    </div>
  );
}
