"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PartyType } from "@/lib/types";

export async function createParty(input: {
  brand_id: string;
  name: string;
  type?: PartyType;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  opening_balance?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parties")
    .insert({
      brand_id: input.brand_id,
      name: input.name.trim(),
      type: input.type ?? "customer",
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      gstin: input.gstin?.trim().toUpperCase() || null,
      address: input.address?.trim() || null,
      state_code: input.gstin?.trim().slice(0, 2) || null,
      opening_balance: input.opening_balance ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function createCategory(input: {
  brand_id: string;
  name: string;
  kind?: "income" | "expense" | "both";
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      brand_id: input.brand_id,
      name: input.name.trim(),
      kind: input.kind ?? "both",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function createPaymentMode(input: { brand_id: string; name: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_modes")
    .insert({ brand_id: input.brand_id, name: input.name.trim() })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function createAccount(input: {
  brand_id: string;
  name: string;
  type?: "cash" | "bank" | "petty" | "wallet";
  opening_balance?: number;
  bank_name?: string;
  account_last4?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      brand_id: input.brand_id,
      name: input.name.trim(),
      type: input.type ?? "cash",
      opening_balance: input.opening_balance ?? 0,
      bank_name: input.bank_name?.trim() || null,
      account_last4: input.account_last4?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: data.id as string };
}

export async function deleteRecord(table: string, id: string, brandId: string) {
  const allowed = ["parties", "categories", "payment_modes", "accounts", "items"];
  if (!allowed.includes(table)) return { error: "Not allowed" };

  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/b/${brandId}`, "layout");
  return {};
}
