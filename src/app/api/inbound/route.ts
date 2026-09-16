import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseBankAlert } from "@/lib/bank-parser";

/**
 * Receives forwarded bank/UPI alert emails and turns them into cash book
 * entries. The mail provider posts here; the shared secret is what makes the
 * call trustworthy, since this route runs without a signed-in user.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-webhook-secret") ??
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    to?: string;
    from?: string;
    subject?: string;
    text?: string;
    html?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toAddress = extractAddress(payload.to);
  if (!toAddress) {
    return NextResponse.json({ error: "Missing recipient" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: inbound } = await supabase
    .from("inbound_addresses")
    .select("brand_id, default_account_id, is_active")
    .eq("address", toAddress)
    .maybeSingle();

  if (!inbound?.is_active) {
    return NextResponse.json({ error: "Unknown address" }, { status: 404 });
  }

  const body = payload.text || payload.html || "";
  const parsed = parseBankAlert(body, payload.subject ?? "");

  const record = {
    brand_id: inbound.brand_id,
    to_address: toAddress,
    from_address: extractAddress(payload.from),
    subject: payload.subject ?? null,
    raw_body: body.slice(0, 20000),
    parsed,
  };

  if (!parsed) {
    await supabase.from("email_imports").insert({
      ...record,
      status: "ignored",
      error: "Not recognised as a transaction alert",
    });
    return NextResponse.json({ status: "ignored" });
  }

  if (parsed.bankRef) {
    const { data: duplicate } = await supabase
      .from("transactions")
      .select("id")
      .eq("brand_id", inbound.brand_id)
      .eq("bank_ref", parsed.bankRef)
      .maybeSingle();

    if (duplicate) {
      await supabase.from("email_imports").insert({
        ...record,
        status: "duplicate",
        transaction_id: duplicate.id,
      });
      return NextResponse.json({ status: "duplicate" });
    }
  }

  let accountId = inbound.default_account_id;
  if (!accountId) {
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("brand_id", inbound.brand_id)
      .eq("is_active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    accountId = account?.id ?? null;
  }

  if (!accountId) {
    await supabase.from("email_imports").insert({
      ...record,
      status: "failed",
      error: "Brand has no account to post into",
    });
    return NextResponse.json({ error: "No account" }, { status: 422 });
  }

  // Reuse how this counterparty was categorised last time, so repeat payments
  // land fully filled in rather than needing the same edits again.
  const matchKey = (parsed.counterparty ?? "").toLowerCase().trim();
  const { data: rule } = matchKey
    ? await supabase
        .from("counterparty_rules")
        .select("party_id, category_id, payment_mode_id")
        .eq("brand_id", inbound.brand_id)
        .eq("match_key", matchKey)
        .maybeSingle()
    : { data: null };

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      brand_id: inbound.brand_id,
      account_id: accountId,
      direction: parsed.direction,
      amount: parsed.amount,
      txn_date: parsed.date ?? new Date().toISOString().slice(0, 10),
      remark: parsed.note ?? parsed.counterparty ?? "Bank alert",
      counterparty: parsed.counterparty,
      bank_ref: parsed.bankRef,
      party_id: rule?.party_id ?? null,
      category_id: rule?.category_id ?? null,
      payment_mode_id: rule?.payment_mode_id ?? null,
      source: "email",
      needs_review: true,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.from("email_imports").insert({
      ...record,
      status: "failed",
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("email_imports").insert({
    ...record,
    status: "imported",
    transaction_id: transaction.id,
  });

  return NextResponse.json({ status: "imported", id: transaction.id });
}

function extractAddress(value: string | undefined | null) {
  if (!value) return null;
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}
