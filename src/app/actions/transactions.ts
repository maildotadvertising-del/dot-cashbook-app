"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import type { Direction } from "@/lib/types";

export interface TransactionInput {
  brand_id: string;
  account_id: string;
  direction: Direction;
  amount: number;
  txn_date: string;
  remark?: string | null;
  party_id?: string | null;
  category_id?: string | null;
  payment_mode_id?: string | null;
  bill_url?: string | null;
}

async function currentUserId() {
  return (await getSessionUser())?.id ?? null;
}

export async function createTransaction(input: TransactionInput) {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      ...input,
      remark: input.remark?.trim() || null,
      party_id: input.party_id || null,
      category_id: input.category_id || null,
      payment_mode_id: input.payment_mode_id || null,
      created_by: userId,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    brand_id: input.brand_id,
    entity_type: "transaction",
    entity_id: data.id,
    action: "created",
    actor_id: userId,
    detail: { amount: input.amount, direction: input.direction },
  });

  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function updateTransaction(id: string, input: Partial<TransactionInput>) {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("transactions")
    .update({ ...input, needs_review: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("brand_id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    brand_id: data.brand_id,
    entity_type: "transaction",
    entity_id: id,
    action: "updated",
    actor_id: userId,
    detail: input as Record<string, unknown>,
  });

  revalidatePath(`/b/${data.brand_id}`, "layout");
  return {};
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: existing } = await supabase
    .from("transactions")
    .select("brand_id, transfer_id, amount, direction")
    .eq("id", id)
    .single();

  if (!existing) return { error: "Entry not found" };

  // A transfer is two linked entries — removing one alone would leave the
  // other brand's book wrong, so the whole transfer goes.
  if (existing.transfer_id) {
    const { error } = await supabase.from("transfers").delete().eq("id", existing.transfer_id);
    if (error) return { error: error.message };
    await supabase.from("transactions").delete().eq("transfer_id", existing.transfer_id);
  } else {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return { error: error.message };
  }

  await supabase.from("activity_log").insert({
    brand_id: existing.brand_id,
    entity_type: "transaction",
    entity_id: id,
    action: "deleted",
    actor_id: userId,
    detail: { amount: existing.amount, direction: existing.direction },
  });

  revalidatePath(`/b/${existing.brand_id}`, "layout");
  return {};
}

/** Copies an entry into another brand's book, optionally flipping its direction. */
export async function copyTransaction(
  id: string,
  targetBrandId: string,
  targetAccountId: string,
  opposite: boolean,
) {
  const supabase = await createClient();
  const userId = await currentUserId();

  const { data: source } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (!source) return { error: "Entry not found" };

  const { error } = await supabase.from("transactions").insert({
    brand_id: targetBrandId,
    account_id: targetAccountId,
    direction: opposite ? (source.direction === "in" ? "out" : "in") : source.direction,
    amount: source.amount,
    txn_date: source.txn_date,
    remark: source.remark,
    created_by: userId,
    source: "manual",
  });

  if (error) return { error: error.message };
  revalidatePath(`/b/${targetBrandId}`, "layout");
  return {};
}

/**
 * Moves money between two brands as a single action: one "out" entry in the
 * sending brand and one "in" entry in the receiving brand, linked by a
 * transfer row so both sides stay traceable to each other.
 */
export async function createTransfer(input: {
  from_brand_id: string;
  to_brand_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  note?: string | null;
}) {
  const supabase = await createClient();
  const userId = await currentUserId();

  if (input.from_brand_id === input.to_brand_id) {
    return { error: "Pick two different brands" };
  }

  const [{ data: fromBrand }, { data: toBrand }] = await Promise.all([
    supabase.from("brands").select("id, name, company_id").eq("id", input.from_brand_id).single(),
    supabase.from("brands").select("id, name").eq("id", input.to_brand_id).single(),
  ]);

  if (!fromBrand || !toBrand) return { error: "Brand not found" };

  const { data: transfer, error: transferError } = await supabase
    .from("transfers")
    .insert({
      company_id: fromBrand.company_id,
      from_brand_id: input.from_brand_id,
      to_brand_id: input.to_brand_id,
      amount: input.amount,
      transfer_date: input.transfer_date,
      note: input.note?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (transferError) return { error: transferError.message };

  const base = {
    amount: input.amount,
    txn_date: input.transfer_date,
    source: "transfer" as const,
    transfer_id: transfer.id,
    created_by: userId,
  };

  const { data: pair, error: txnError } = await supabase
    .from("transactions")
    .insert([
      {
        ...base,
        brand_id: input.from_brand_id,
        account_id: input.from_account_id,
        direction: "out" as const,
        remark: input.note?.trim() || `Transfer to ${toBrand.name}`,
        counterparty: toBrand.name,
      },
      {
        ...base,
        brand_id: input.to_brand_id,
        account_id: input.to_account_id,
        direction: "in" as const,
        remark: input.note?.trim() || `Transfer from ${fromBrand.name}`,
        counterparty: fromBrand.name,
      },
    ])
    .select("id, direction");

  if (txnError) {
    await supabase.from("transfers").delete().eq("id", transfer.id);
    return { error: txnError.message };
  }

  await supabase
    .from("transfers")
    .update({
      from_transaction_id: pair?.find((t) => t.direction === "out")?.id ?? null,
      to_transaction_id: pair?.find((t) => t.direction === "in")?.id ?? null,
    })
    .eq("id", transfer.id);

  revalidatePath("/", "layout");
  return { id: transfer.id as string };
}
