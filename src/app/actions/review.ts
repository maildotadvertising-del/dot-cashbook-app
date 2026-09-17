"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirms an auto-imported entry and remembers its classification against
 * the counterparty, which is what lets the next alert from the same payee
 * arrive already categorised.
 */
export async function confirmReviewed(
  id: string,
  input: { party_id: string | null; category_id: string | null; payment_mode_id: string | null; remark?: string },
) {
  const supabase = await createClient();

  const { data: txn, error } = await supabase
    .from("transactions")
    .update({
      party_id: input.party_id,
      category_id: input.category_id,
      payment_mode_id: input.payment_mode_id,
      ...(input.remark !== undefined ? { remark: input.remark.trim() || null } : {}),
      needs_review: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("brand_id, counterparty")
    .single();

  if (error) return { error: error.message };

  const matchKey = (txn.counterparty ?? "").toLowerCase().trim();
  if (matchKey && (input.party_id || input.category_id || input.payment_mode_id)) {
    const { data: existing } = await supabase
      .from("counterparty_rules")
      .select("id, hit_count")
      .eq("brand_id", txn.brand_id)
      .eq("match_key", matchKey)
      .maybeSingle();

    const rule = {
      party_id: input.party_id,
      category_id: input.category_id,
      payment_mode_id: input.payment_mode_id,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("counterparty_rules")
        .update({ ...rule, hit_count: existing.hit_count + 1 })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("counterparty_rules")
        .insert({ ...rule, brand_id: txn.brand_id, match_key: matchKey });
    }
  }

  revalidatePath(`/b/${txn.brand_id}`, "layout");
  return {};
}

export async function confirmAllReviewed(brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ needs_review: false })
    .eq("brand_id", brandId)
    .eq("needs_review", true);

  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}
