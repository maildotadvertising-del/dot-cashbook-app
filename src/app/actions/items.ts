"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ItemInput {
  brand_id: string;
  name: string;
  kind: "product" | "service";
  description?: string | null;
  hsn_sac?: string | null;
  unit?: string;
  rate?: number;
  gst_rate?: number;
}

export async function saveItem(input: ItemInput & { id?: string }) {
  const supabase = await createClient();
  const payload = {
    brand_id: input.brand_id,
    name: input.name.trim(),
    kind: input.kind,
    description: input.description?.trim() || null,
    hsn_sac: input.hsn_sac?.trim() || null,
    unit: input.unit?.trim() || "nos",
    rate: input.rate ?? 0,
    gst_rate: input.gst_rate ?? 18,
  };

  const { error } = input.id
    ? await supabase.from("items").update(payload).eq("id", input.id)
    : await supabase.from("items").insert(payload);

  if (error) return { error: error.message };
  revalidatePath(`/b/${input.brand_id}`, "layout");
  return {};
}
