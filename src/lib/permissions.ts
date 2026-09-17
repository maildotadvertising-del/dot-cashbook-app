import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrandPermissions {
  brand_id: string;
  can_write: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_manage: boolean;
  can_reports: boolean;
  can_see_all: boolean;
}

// UI hints only — RLS enforces the same rules server-side regardless.
export async function allBrandPermissions(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("my_brand_permissions");
  return (data ?? []) as BrandPermissions[];
}

export async function brandPermissions(supabase: SupabaseClient, brandId: string) {
  return (await allBrandPermissions(supabase)).find((p) => p.brand_id === brandId) ?? null;
}
