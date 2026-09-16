import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentEditor } from "@/components/documents/document-editor";
import { DocumentList, type DocumentListRow } from "@/components/documents/document-list";
import { DocumentView } from "@/components/documents/document-view";
import type { DocType } from "@/lib/types";

async function loadBrand(brandId: string) {
  const supabase = await createClient();
  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();
  return brand;
}

export async function DocumentListPage({
  brandId,
  docType,
}: {
  brandId: string;
  docType: DocType;
}) {
  const supabase = await createClient();
  const brand = await loadBrand(brandId);

  const { data } = await supabase
    .from("documents")
    .select(
      "id, doc_number, doc_date, due_date, total, amount_paid, status, is_gst, party:parties(name)",
    )
    .eq("brand_id", brandId)
    .eq("doc_type", docType)
    .order("doc_date", { ascending: false })
    .order("doc_number", { ascending: false });

  const documents: DocumentListRow[] = (data ?? []).map((d) => ({
    ...d,
    party: Array.isArray(d.party) ? (d.party[0] ?? null) : d.party,
  })) as DocumentListRow[];

  return <DocumentList brand={brand} docType={docType} documents={documents} />;
}

export async function DocumentNewPage({
  brandId,
  docType,
}: {
  brandId: string;
  docType: DocType;
}) {
  const supabase = await createClient();
  const brand = await loadBrand(brandId);

  const [{ data: parties }, { data: items }] = await Promise.all([
    supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("items").select("*").eq("brand_id", brandId).eq("is_active", true).order("name"),
  ]);

  return (
    <DocumentEditor
      brand={brand}
      docType={docType}
      parties={parties ?? []}
      items={items ?? []}
    />
  );
}

async function loadDocument(docId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("*").eq("id", docId).single();
  if (!doc) notFound();

  const [{ data: lines }, { data: party }] = await Promise.all([
    supabase.from("document_items").select("*").eq("document_id", docId).order("sort_order"),
    doc.party_id
      ? supabase.from("parties").select("*").eq("id", doc.party_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return { doc, lines: lines ?? [], party };
}

export async function DocumentDetailPage({
  brandId,
  docId,
}: {
  brandId: string;
  docId: string;
}) {
  const supabase = await createClient();
  const brand = await loadBrand(brandId);
  const { doc, lines, party } = await loadDocument(docId);

  const [{ data: accounts }, { data: modes }, { data: payments }] = await Promise.all([
    supabase.from("accounts").select("*").eq("brand_id", brandId).order("sort_order"),
    supabase.from("payment_modes").select("*").eq("brand_id", brandId).order("name"),
    supabase
      .from("document_payments")
      .select("id, amount, paid_on")
      .eq("document_id", docId)
      .order("paid_on"),
  ]);

  return (
    <DocumentView
      brand={brand}
      doc={doc}
      lines={lines}
      party={party}
      accounts={accounts ?? []}
      paymentModes={modes ?? []}
      payments={payments ?? []}
    />
  );
}

export async function DocumentEditPage({
  brandId,
  docId,
}: {
  brandId: string;
  docId: string;
}) {
  const supabase = await createClient();
  const brand = await loadBrand(brandId);
  const { doc, lines } = await loadDocument(docId);

  const [{ data: parties }, { data: items }] = await Promise.all([
    supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
    supabase.from("items").select("*").eq("brand_id", brandId).eq("is_active", true).order("name"),
  ]);

  return (
    <DocumentEditor
      brand={brand}
      docType={doc.doc_type}
      parties={parties ?? []}
      items={items ?? []}
      existing={doc}
      existingLines={lines}
    />
  );
}
