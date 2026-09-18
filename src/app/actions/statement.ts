"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { fallbackRef, type StatementRow } from "@/lib/statement";
import { loadClassifier } from "@/lib/auto-classify";
import { LABEL_COLORS } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function nameResolver(
  supabase: Supabase,
  table: "categories" | "labels",
  brandId: string,
  wanted: string[],
  create: boolean,
) {
  const { data } = await supabase.from(table).select("id, name").eq("brand_id", brandId);
  const byName = new Map((data ?? []).map((r) => [String(r.name).toLowerCase(), r.id as string]));

  if (create) {
    const missing = [...new Set(wanted.map((w) => w.trim()).filter(Boolean))].filter(
      (name) => !byName.has(name.toLowerCase()),
    );
    if (missing.length) {
      const rows = missing.map((name, i) =>
        table === "labels"
          ? { brand_id: brandId, name, color: LABEL_COLORS[(byName.size + i) % LABEL_COLORS.length] }
          : { brand_id: brandId, name },
      );
      const { data: created } = await supabase.from(table).insert(rows).select("id, name");
      created?.forEach((r) => byName.set(String(r.name).toLowerCase(), r.id as string));
    }
  }

  return (name: string) => byName.get(name.trim().toLowerCase()) ?? null;
}

const CHUNK = 400;

export async function importStatement(input: {
  brand_id: string;
  account_id: string;
  rows: StatementRow[];
  /** Create categories/labels named in an app export that don't exist yet. */
  createMissing?: boolean;
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

  const classify = await loadClassifier(supabase, input.brand_id);
  const fresh = keyed.filter((r) => !existing.has(r.ref));

  // App exports (Wallet) name their category and labels; match those to this
  // brand's by name, case-insensitively. Existing ones are never renamed.
  const categoryId = await nameResolver(
    supabase,
    "categories",
    input.brand_id,
    fresh.map((r) => r.category).filter((c): c is string => !!c && !/^transfer$/i.test(c)),
    input.createMissing ?? false,
  );
  const labelId = await nameResolver(
    supabase,
    "labels",
    input.brand_id,
    fresh.flatMap((r) => r.labels),
    input.createMissing ?? false,
  );

  const records = fresh.map((row) => {
    const auto = classify({ text: row.narration, counterparty: row.counterparty, direction: row.direction });
    const fileCategory = row.category ? categoryId(row.category) : null;
    const fileLabels = row.labels.map(labelId).filter((id): id is string => !!id);
    return {
      brand_id: input.brand_id,
      account_id: input.account_id,
      direction: row.direction,
      amount: row.amount,
      txn_date: row.date,
      remark: (row.note ?? row.counterparty ?? row.narration).slice(0, 200) || null,
      counterparty: row.counterparty,
      bank_ref: row.ref,
      ...auto,
      category_id: fileCategory ?? auto.category_id,
      label_ids: fileLabels.length ? fileLabels : auto.label_ids,
      source: "statement" as const,
      // Already-categorised rows (from an app export) don't need a second look.
      needs_review: !(fileCategory ?? auto.category_id),
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
