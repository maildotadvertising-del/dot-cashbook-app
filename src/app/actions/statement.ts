"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { fallbackRef, type StatementRow } from "@/lib/statement";

const CHUNK = 400;

export async function importStatement(input: {
  brand_id: string;
  account_id: string;
  rows: StatementRow[];
}) {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!input.rows.length) return { error: "No rows to import" };
  if (input.rows.length > 5000) return { error: "Split statements larger than 5,000 rows" };

  // Identical rows in one file (two ₹20 tea entries the same day) are real,
  // separate transactions, so repeated fallback keys get a running suffix.
  const seen = new Map<string, number>();
  const keyed = input.rows.map((row) => {
    let ref = row.ref;
    if (!ref) {
      const base = fallbackRef(row);
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      ref = count === 1 ? base : `${base}-${count}`;
    }
    return { ...row, ref };
  });

  const existing = new Set<string>();
  const refs = keyed.map((r) => r.ref);
  for (let i = 0; i < refs.length; i += CHUNK) {
    const { data } = await supabase
      .from("transactions")
      .select("bank_ref")
      .eq("brand_id", input.brand_id)
      .in("bank_ref", refs.slice(i, i + CHUNK));
    data?.forEach((d) => d.bank_ref && existing.add(d.bank_ref));
  }

  const { data: rules } = await supabase
    .from("counterparty_rules")
    .select("match_key, party_id, category_id, payment_mode_id")
    .eq("brand_id", input.brand_id);
  const ruleFor = new Map((rules ?? []).map((r) => [r.match_key, r]));

  const fresh = keyed.filter((r) => !existing.has(r.ref));
  const records = fresh.map((row) => {
    const rule = row.counterparty ? ruleFor.get(row.counterparty.toLowerCase().trim()) : undefined;
    return {
      brand_id: input.brand_id,
      account_id: input.account_id,
      direction: row.direction,
      amount: row.amount,
      txn_date: row.date,
      remark: (row.note ?? row.counterparty ?? row.narration).slice(0, 200) || null,
      counterparty: row.counterparty,
      bank_ref: row.ref,
      party_id: rule?.party_id ?? null,
      category_id: rule?.category_id ?? null,
      payment_mode_id: rule?.payment_mode_id ?? null,
      source: "statement" as const,
      needs_review: true,
      created_by: user?.id ?? null,
    };
  });

  for (let i = 0; i < records.length; i += CHUNK) {
    const { error } = await supabase.from("transactions").insert(records.slice(i, i + CHUNK));
    if (error) {
      return {
        error: `${error.message} (imported ${i} of ${records.length} before stopping)`,
      };
    }
  }

  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { imported: records.length, skipped: keyed.length - records.length };
}
