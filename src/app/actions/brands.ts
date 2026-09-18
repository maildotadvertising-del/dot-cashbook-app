"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";

const DEFAULT_ACCOUNTS = [
  { name: "Cash", type: "cash" as const, sort_order: 0 },
  { name: "Bank", type: "bank" as const, sort_order: 1 },
];

const DEFAULT_CATEGORIES = [
  { name: "Sales", kind: "income" as const },
  { name: "Service Income", kind: "income" as const },
  { name: "Other Income", kind: "income" as const },
  { name: "Purchase", kind: "expense" as const },
  { name: "Salary", kind: "expense" as const },
  { name: "Rent", kind: "expense" as const },
  { name: "Electricity", kind: "expense" as const },
  { name: "Travel", kind: "expense" as const },
  { name: "Office Expense", kind: "expense" as const },
  { name: "Tea & Snacks", kind: "expense" as const },
  { name: "Advertising", kind: "expense" as const },
  { name: "Bank Charges", kind: "expense" as const },
];

const DEFAULT_PAYMENT_MODES = [
  "Cash",
  "Google Pay",
  "PhonePe",
  "Paytm",
  "UPI",
  "Bank Transfer",
  "Cheque",
  "Card",
];

export async function createBrand(input: {
  name: string;
  legal_name?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  state_code?: string;
  invoice_prefix?: string;
}) {
  const supabase = await createClient();

  const user = await getSessionUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) return { error: "No company found for this account" };

  const { data: brand, error } = await supabase
    .from("brands")
    .insert({
      company_id: profile.company_id,
      name: input.name.trim(),
      legal_name: input.legal_name?.trim() || null,
      gstin: input.gstin?.trim().toUpperCase() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      state_code: input.state_code?.trim() || input.gstin?.trim().slice(0, 2) || null,
      invoice_prefix: input.invoice_prefix?.trim().toUpperCase() || "INV",
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await Promise.all([
    supabase
      .from("accounts")
      .insert(DEFAULT_ACCOUNTS.map((a) => ({ ...a, brand_id: brand.id }))),
    supabase
      .from("categories")
      .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, brand_id: brand.id }))),
    supabase
      .from("payment_modes")
      .insert(DEFAULT_PAYMENT_MODES.map((name) => ({ name, brand_id: brand.id }))),
  ]);

  revalidatePath("/", "layout");
  return { brandId: brand.id as string };
}

export async function updateBrand(
  brandId: string,
  input: Partial<{
    name: string;
    legal_name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    state_code: string;
    invoice_prefix: string;
    quotation_prefix: string;
  }>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").update(input).eq("id", brandId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
