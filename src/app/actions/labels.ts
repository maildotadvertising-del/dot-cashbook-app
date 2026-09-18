"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { Direction, Frequency } from "@/lib/types";

// ------------------------------------------------------------------ labels

export async function saveLabel(input: { id?: string; brand_id: string; name: string; color: string }) {
  const supabase = await createClient();
  const payload = { brand_id: input.brand_id, name: input.name.trim(), color: input.color };
  if (!payload.name) return { error: "Enter a label name" };

  const { data, error } = input.id
    ? await supabase.from("labels").update(payload).eq("id", input.id).select("id").single()
    : await supabase.from("labels").insert(payload).select("id").single();

  if (error) {
    return { error: /duplicate|unique/i.test(error.message) ? "A label with that name exists" : error.message };
  }
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function deleteLabel(id: string, brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("labels").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}

// ------------------------------------------------------------- auto rules

export interface RuleInput {
  id?: string;
  brand_id: string;
  name: string;
  keywords: string[];
  direction: Direction | null;
  category_id: string | null;
  party_id: string | null;
  payment_mode_id: string | null;
  label_ids: string[];
  is_active: boolean;
}

export async function saveRule(input: RuleInput) {
  const supabase = await createClient();
  const keywords = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))];
  if (!keywords.length) return { error: "Add at least one keyword" };
  if (!input.category_id && !input.party_id && !input.payment_mode_id && !input.label_ids.length) {
    return { error: "Pick what the rule should fill in" };
  }

  const payload = {
    brand_id: input.brand_id,
    name: input.name.trim() || keywords[0],
    keywords,
    direction: input.direction,
    category_id: input.category_id,
    party_id: input.party_id,
    payment_mode_id: input.payment_mode_id,
    label_ids: input.label_ids,
    is_active: input.is_active,
  };

  let error;
  if (input.id) {
    ({ error } = await supabase.from("category_rules").update(payload).eq("id", input.id));
  } else {
    // New rules go to the end; order decides which rule wins on overlap.
    const { data: last } = await supabase
      .from("category_rules")
      .select("sort_order")
      .eq("brand_id", input.brand_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error } = await supabase
      .from("category_rules")
      .insert({ ...payload, sort_order: (last?.sort_order ?? -1) + 1 }));
  }

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return {};
}

export async function deleteRule(id: string, brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}

// ------------------------------------------------------------- recurring

export interface RecurringInput {
  id?: string;
  brand_id: string;
  name: string;
  direction: Direction;
  amount: number;
  account_id: string;
  category_id: string | null;
  party_id: string | null;
  payment_mode_id: string | null;
  label_ids: string[];
  remark: string | null;
  frequency: Frequency;
  next_due: string;
  is_active: boolean;
}

export async function saveRecurring(input: RecurringInput) {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!input.name.trim()) return { error: "Give it a name" };
  if (!(input.amount > 0)) return { error: "Enter an amount" };

  const payload = {
    brand_id: input.brand_id,
    name: input.name.trim(),
    direction: input.direction,
    amount: input.amount,
    account_id: input.account_id,
    category_id: input.category_id,
    party_id: input.party_id,
    payment_mode_id: input.payment_mode_id,
    label_ids: input.label_ids,
    remark: input.remark?.trim() || null,
    frequency: input.frequency,
    next_due: input.next_due,
    is_active: input.is_active,
  };

  const { error } = input.id
    ? await supabase.from("recurring_entries").update(payload).eq("id", input.id)
    : await supabase.from("recurring_entries").insert({ ...payload, created_by: user?.id ?? null });

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return {};
}

export async function deleteRecurring(id: string, brandId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_entries").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}

function advance(date: string, frequency: Frequency) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else {
    const months = { monthly: 1, quarterly: 3, yearly: 12 }[frequency];
    // Clamp to month end so a 31st rent doesn't drift into the next month.
    const target = new Date(Date.UTC(y, m - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, lastDay));
    return target.toISOString().slice(0, 10);
  }
  return next.toISOString().slice(0, 10);
}

/**
 * Posts this occurrence into the cash book (optionally with an adjusted
 * amount/date) and moves the schedule to the next due date. `skip` moves the
 * schedule without posting anything.
 */
export async function postRecurring(
  id: string,
  opts: { skip?: boolean; amount?: number; date?: string } = {},
) {
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: entry } = await supabase.from("recurring_entries").select("*").eq("id", id).single();
  if (!entry) return { error: "Recurring entry not found" };

  if (!opts.skip) {
    const { error } = await supabase.from("transactions").insert({
      brand_id: entry.brand_id,
      account_id: entry.account_id,
      direction: entry.direction,
      amount: opts.amount ?? entry.amount,
      txn_date: opts.date ?? entry.next_due,
      remark: entry.remark || entry.name,
      party_id: entry.party_id,
      category_id: entry.category_id,
      payment_mode_id: entry.payment_mode_id,
      label_ids: entry.label_ids,
      created_by: user?.id ?? null,
      source: "manual",
    });
    if (error) return { error: error.message };
  }

  const { error } = await supabase
    .from("recurring_entries")
    .update({ next_due: advance(entry.next_due, entry.frequency) })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/b/${entry.brand_id}`, "layout");
  return {};
}
