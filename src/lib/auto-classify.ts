import type { SupabaseClient } from "@supabase/supabase-js";
import { matchRule } from "@/lib/rules";
import type { CategoryRule, Direction } from "@/lib/types";

export interface Classification {
  party_id: string | null;
  category_id: string | null;
  payment_mode_id: string | null;
  label_ids: string[];
}

const EMPTY: Classification = { party_id: null, category_id: null, payment_mode_id: null, label_ids: [] };

/**
 * Loads a brand's classification memory once and returns a function that
 * fills in party/category/mode/labels for an imported entry. The exact
 * counterparty a human already confirmed wins; keyword rules cover the rest.
 */
export async function loadClassifier(supabase: SupabaseClient, brandId: string) {
  const [{ data: remembered }, { data: rules }] = await Promise.all([
    supabase
      .from("counterparty_rules")
      .select("match_key, party_id, category_id, payment_mode_id")
      .eq("brand_id", brandId),
    supabase.from("category_rules").select("*").eq("brand_id", brandId).eq("is_active", true),
  ]);

  const byCounterparty = new Map((remembered ?? []).map((r) => [r.match_key as string, r]));

  return (entry: { text: string; counterparty: string | null; direction: Direction }): Classification => {
    const key = entry.counterparty?.toLowerCase().trim();
    const exact = key ? byCounterparty.get(key) : undefined;
    const hit = matchRule((rules ?? []) as CategoryRule[], `${entry.text} ${entry.counterparty ?? ""}`, entry.direction);

    if (!exact && !hit) return EMPTY;

    return {
      party_id: exact?.party_id ?? hit?.rule.party_id ?? null,
      category_id: exact?.category_id ?? hit?.rule.category_id ?? null,
      payment_mode_id: exact?.payment_mode_id ?? hit?.rule.payment_mode_id ?? null,
      label_ids: hit?.rule.label_ids ?? [],
    };
  };
}
