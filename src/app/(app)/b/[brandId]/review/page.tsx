import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewView } from "@/components/review/review-view";
import type { TransactionRow } from "@/lib/types";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const supabase = await createClient();

  const { data: brand } = await supabase.from("brands").select("*").eq("id", brandId).single();
  if (!brand) notFound();

  const [{ data: pending }, { data: categories }, { data: modes }, { data: parties }, { data: skipped }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select(
          `*, party:parties(id, name, type), category:categories(id, name),
           payment_mode:payment_modes(id, name), account:accounts(id, name, type)`,
        )
        .eq("brand_id", brandId)
        .eq("needs_review", true)
        .order("txn_date", { ascending: false })
        .limit(100),
      supabase.from("categories").select("*").eq("brand_id", brandId).order("name"),
      supabase.from("payment_modes").select("*").eq("brand_id", brandId).order("name"),
      supabase.from("parties").select("*").eq("brand_id", brandId).order("name"),
      supabase
        .from("email_imports")
        .select("id, subject, from_address, status, error, received_at, raw_body")
        .eq("brand_id", brandId)
        .in("status", ["ignored", "failed"])
        .order("received_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <ReviewView
      brand={brand}
      pending={(pending ?? []) as TransactionRow[]}
      categories={categories ?? []}
      paymentModes={modes ?? []}
      parties={parties ?? []}
      skipped={skipped ?? []}
    />
  );
}
