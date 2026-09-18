"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { BrandRole } from "@/lib/types";

// The database is the real gatekeeper (RLS + profile guard trigger); these
// actions just shape requests and turn policy failures into readable errors.

export async function inviteMember(input: {
  email: string;
  role: "admin" | "staff";
  brand_ids: string[];
  brand_role: BrandRole;
}) {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return { error: "Not signed in" };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email" };

  const { data: me } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!me?.company_id) return { error: "No company" };

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", me.company_id)
    .ilike("email", email)
    .maybeSingle();
  if (existing) return { error: "That person is already on the team" };

  const { error } = await supabase.from("company_invites").insert({
    company_id: me.company_id,
    email,
    role: input.role,
    brand_ids: input.role === "admin" ? [] : input.brand_ids,
    brand_role: input.brand_role,
    invited_by: user.id,
  });

  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "That email already has a pending invite"
        : error.message,
    };
  }

  revalidatePath("/company");
  return {};
}

export async function revokeInvite(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("company_invites").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/company");
  return {};
}

export async function setCompanyRole(userId: string, role: "admin" | "staff") {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export interface BrandAccess {
  role: BrandRole;
  can_edit_entries: boolean;
  can_delete_entries: boolean;
  can_view_reports: boolean;
  can_see_others_entries: boolean;
  backdate_policy: "always" | "never" | "one_day";
}

/** Grants, updates, or (with `null`) removes someone's access to one brand. */
export async function setBrandAccess(userId: string, brandId: string, access: BrandAccess | null) {
  const supabase = await createClient();

  const { error } = access
    ? await supabase
        .from("brand_members")
        .upsert({ user_id: userId, brand_id: brandId, ...access }, { onConflict: "brand_id,user_id" })
    : await supabase.from("brand_members").delete().eq("user_id", userId).eq("brand_id", brandId);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
