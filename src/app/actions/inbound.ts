"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "brand";
}

/**
 * Mints the address the user forwards their bank alert emails to. The random
 * suffix keeps it unguessable, since anything delivered here becomes a ledger
 * entry.
 */
export async function createInboundAddress(brandId: string, accountId: string | null) {
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .single();
  if (!brand) return { error: "Brand not found" };

  const domain = process.env.NEXT_PUBLIC_INBOUND_DOMAIN || "in.dotcashbook.app";
  const suffix = Math.random().toString(36).slice(2, 8);
  const address = `${slugify(brand.name)}-${suffix}@${domain}`;

  const { error } = await supabase.from("inbound_addresses").insert({
    brand_id: brandId,
    address,
    default_account_id: accountId,
  });

  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return { address };
}

export async function setInboundAccount(id: string, accountId: string | null, brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inbound_addresses")
    .update({ default_account_id: accountId })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}

export async function setInboundActive(id: string, isActive: boolean, brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inbound_addresses")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}
