"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { computeTotals, lineAmount } from "@/lib/gst";
import type { DocStatus, DocType } from "@/lib/types";

export interface DocumentLineInput {
  item_id?: string | null;
  name: string;
  description?: string | null;
  hsn_sac?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  discount_pct?: number;
  gst_rate?: number;
}

export interface DocumentInput {
  id?: string;
  brand_id: string;
  doc_type: DocType;
  doc_number?: string;
  party_id: string | null;
  doc_date: string;
  due_date?: string | null;
  is_gst: boolean;
  gst_treatment: "intra" | "inter";
  place_of_supply?: string | null;
  notes?: string | null;
  terms?: string | null;
  status?: DocStatus;
  lines: DocumentLineInput[];
}

export async function saveDocument(input: DocumentInput) {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!input.lines.length) return { error: "Add at least one line item" };

  const totals = computeTotals(
    input.lines.map((l) => ({
      qty: l.qty,
      rate: l.rate,
      discount_pct: l.discount_pct,
      gst_rate: l.gst_rate,
    })),
    { isGst: input.is_gst, treatment: input.gst_treatment },
  );

  let docNumber = input.doc_number;
  if (!input.id && !docNumber) {
    const { data: generated } = await supabase.rpc("next_doc_number", {
      target_brand: input.brand_id,
      target_type: input.doc_type,
    });
    docNumber = generated as string;
  }

  const payload = {
    brand_id: input.brand_id,
    doc_type: input.doc_type,
    doc_number: docNumber!,
    party_id: input.party_id,
    doc_date: input.doc_date,
    due_date: input.due_date || null,
    is_gst: input.is_gst,
    gst_treatment: input.gst_treatment,
    place_of_supply: input.place_of_supply || null,
    subtotal: totals.subtotal,
    discount: totals.discount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    round_off: totals.roundOff,
    total: totals.total,
    notes: input.notes?.trim() || null,
    terms: input.terms?.trim() || null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };

  const { data: doc, error } = input.id
    ? await supabase.from("documents").update(payload).eq("id", input.id).select("id").single()
    : await supabase
        .from("documents")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select("id")
        .single();

  if (error) return { error: error.message };

  // Lines are rewritten wholesale — simpler and safe, since a document's
  // lines are only ever edited together through this form.
  if (input.id) {
    await supabase.from("document_items").delete().eq("document_id", doc.id);
  }

  const { error: lineError } = await supabase.from("document_items").insert(
    input.lines.map((line, index) => ({
      document_id: doc.id,
      item_id: line.item_id || null,
      name: line.name.trim(),
      description: line.description?.trim() || null,
      hsn_sac: line.hsn_sac?.trim() || null,
      qty: line.qty,
      unit: line.unit || null,
      rate: line.rate,
      discount_pct: line.discount_pct ?? 0,
      gst_rate: input.is_gst ? (line.gst_rate ?? 0) : 0,
      amount: lineAmount(line),
      sort_order: index,
    })),
  );

  if (lineError) return { error: lineError.message };

  revalidatePath(`/b/${input.brand_id}`, "layout");
  return { id: doc.id as string, doc_number: docNumber };
}

export async function setDocumentStatus(id: string, status: DocStatus) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("brand_id")
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/b/${data.brand_id}`, "layout");
  return {};
}

export async function deleteDocument(id: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("documents")
    .select("brand_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/b/${existing?.brand_id}`, "layout");
  return {};
}

/** Copies an accepted quotation into a fresh invoice, lines and all. */
export async function convertQuotation(quotationId: string) {
  const supabase = await createClient();

  const [{ data: quote }, { data: lines }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", quotationId).single(),
    supabase
      .from("document_items")
      .select("*")
      .eq("document_id", quotationId)
      .order("sort_order"),
  ]);

  if (!quote) return { error: "Quotation not found" };

  const result = await saveDocument({
    brand_id: quote.brand_id,
    doc_type: "invoice",
    party_id: quote.party_id,
    doc_date: new Date().toISOString().slice(0, 10),
    is_gst: quote.is_gst,
    gst_treatment: quote.gst_treatment,
    place_of_supply: quote.place_of_supply,
    notes: quote.notes,
    terms: quote.terms,
    status: "sent",
    lines: (lines ?? []).map((l) => ({
      item_id: l.item_id,
      name: l.name,
      description: l.description,
      hsn_sac: l.hsn_sac,
      qty: Number(l.qty),
      unit: l.unit,
      rate: Number(l.rate),
      discount_pct: Number(l.discount_pct),
      gst_rate: Number(l.gst_rate),
    })),
  });

  if (result.error) return result;

  await supabase
    .from("documents")
    .update({ converted_from: quotationId, status: "sent" })
    .eq("id", result.id!);
  await supabase.from("documents").update({ status: "accepted" }).eq("id", quotationId);

  revalidatePath(`/b/${quote.brand_id}`, "layout");
  return result;
}

/**
 * Records a payment against an invoice and, when an account is given, posts
 * the matching cash book entry so the ledger and the invoice agree.
 */
export async function recordPayment(input: {
  document_id: string;
  amount: number;
  paid_on: string;
  account_id?: string | null;
  payment_mode_id?: string | null;
}) {
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, brand_id, doc_type, doc_number, party_id")
    .eq("id", input.document_id)
    .single();

  if (!doc) return { error: "Document not found" };

  let transactionId: string | null = null;

  if (input.account_id) {
    const { data: txn, error: txnError } = await supabase
      .from("transactions")
      .insert({
        brand_id: doc.brand_id,
        account_id: input.account_id,
        direction: doc.doc_type === "purchase_bill" ? "out" : "in",
        amount: input.amount,
        txn_date: input.paid_on,
        remark: `Payment for ${doc.doc_number}`,
        party_id: doc.party_id,
        payment_mode_id: input.payment_mode_id || null,
        source: "document",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (txnError) return { error: txnError.message };
    transactionId = txn.id;
  }

  const { error } = await supabase.from("document_payments").insert({
    document_id: input.document_id,
    transaction_id: transactionId,
    amount: input.amount,
    paid_on: input.paid_on,
  });

  if (error) return { error: error.message };

  revalidatePath(`/b/${doc.brand_id}`, "layout");
  return {};
}
