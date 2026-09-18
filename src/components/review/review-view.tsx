"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCheck, Inbox, KeyRound, Loader2, Minus, Plus } from "lucide-react";
import { Combo } from "@/components/combo";
import { EmptyState, GlassCard, PageHeader, Pill } from "@/components/ui";
import { confirmAllReviewed, confirmReviewed } from "@/app/actions/review";
import { createCategory, createParty } from "@/app/actions/masters";
import { cn, formatDate, formatDateTime, money } from "@/lib/utils";
import type { Brand, Category, Party, PaymentMode, TransactionRow } from "@/lib/types";

interface SkippedMail {
  id: string;
  subject: string | null;
  from_address: string | null;
  status: string;
  error: string | null;
  received_at: string;
  raw_body: string | null;
}

/** Gmail's forwarding-confirmation mail carries the code the user must paste back. */
function gmailCode(mail: SkippedMail) {
  const text = `${mail.subject ?? ""} ${mail.raw_body ?? ""}`;
  if (!/forwarding confirmation/i.test(text)) return null;
  return text.match(/confirmation code:\s*(\d{6,12})/i)?.[1] ?? null;
}

export function ReviewView({
  brand,
  pending,
  categories,
  paymentModes,
  parties,
  skipped,
}: {
  brand: Brand;
  pending: TransactionRow[];
  categories: Category[];
  paymentModes: PaymentMode[];
  parties: Party[];
  skipped: SkippedMail[];
}) {
  const [busyAll, setBusyAll] = useState(false);
  const codes = skipped
    .map((mail) => ({ mail, code: gmailCode(mail) }))
    .filter((entry) => entry.code);

  async function confirmAll() {
    setBusyAll(true);
    const result = await confirmAllReviewed(brand.id);
    setBusyAll(false);
    if (result.error) return toast.error(result.error);
    toast.success("All entries confirmed");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Review"
        subtitle={`${pending.length} auto-imported ${pending.length === 1 ? "entry" : "entries"} to check`}
        actions={
          pending.length > 1 && (
            <button className="btn btn-ghost" onClick={confirmAll} disabled={busyAll}>
              {busyAll ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              Confirm all
            </button>
          )
        }
      />

      {codes.map(({ mail, code }) => (
        <GlassCard key={mail.id} strong className="mb-3 flex flex-wrap items-center gap-3">
          <KeyRound className="size-5 text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Gmail forwarding confirmation code</p>
            <p className="text-xs text-[var(--fg-muted)]">
              Paste this in Gmail → Settings → Forwarding to finish setup
            </p>
          </div>
          <button
            className="btn btn-accent money text-lg tracking-widest"
            onClick={() => {
              navigator.clipboard.writeText(code!);
              toast.success("Code copied");
            }}
          >
            {code}
          </button>
        </GlassCard>
      ))}

      {!pending.length ? (
        <GlassCard>
          <EmptyState
            icon={<Inbox className="size-9" />}
            title="All caught up"
            description="Entries captured from bank alert emails show up here until you confirm them."
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pending.map((txn) => (
            <ReviewCard
              key={txn.id}
              brandId={brand.id}
              txn={txn}
              categories={categories}
              paymentModes={paymentModes}
              parties={parties}
            />
          ))}
        </div>
      )}

      {skipped.some((mail) => !gmailCode(mail)) && (
        <GlassCard className="mt-4">
          <h2 className="mb-1 text-sm font-semibold">Mails not turned into entries</h2>
          <p className="mb-3 text-xs text-[var(--fg-muted)]">
            If a real transaction shows up here, add it by hand from the cash book.
          </p>
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {skipped
              .filter((mail) => !gmailCode(mail))
              .map((mail) => (
                <div key={mail.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{mail.subject ?? "(no subject)"}</span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {mail.from_address} · {formatDateTime(mail.received_at)}
                      {mail.error ? ` · ${mail.error}` : ""}
                    </span>
                  </span>
                  <Pill tone={mail.status === "failed" ? "out" : "neutral"}>{mail.status}</Pill>
                </div>
              ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function ReviewCard({
  brandId,
  txn,
  categories,
  paymentModes,
  parties,
}: {
  brandId: string;
  txn: TransactionRow;
  categories: Category[];
  paymentModes: PaymentMode[];
  parties: Party[];
}) {
  const [busy, setBusy] = useState(false);
  const [remark, setRemark] = useState(txn.remark ?? "");
  const [partyId, setPartyId] = useState(txn.party_id);
  const [categoryId, setCategoryId] = useState(txn.category_id);
  const [modeId, setModeId] = useState(txn.payment_mode_id);

  async function confirm() {
    setBusy(true);
    const result = await confirmReviewed(txn.id, {
      party_id: partyId,
      category_id: categoryId,
      payment_mode_id: modeId,
      remark,
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Confirmed");
  }

  return (
    <GlassCard className="!p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            txn.direction === "in"
              ? "bg-[var(--in-soft)] text-[var(--in)]"
              : "bg-[var(--out-soft)] text-[var(--out)]",
          )}
        >
          {txn.direction === "in" ? <Plus className="size-4" /> : <Minus className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{txn.counterparty ?? "Unknown"}</span>
          <span className="block text-xs text-[var(--fg-muted)]">
            {formatDate(txn.txn_date)} · {txn.account?.name}
            {txn.bank_ref ? ` · Ref ${txn.bank_ref}` : ""}
          </span>
        </span>
        <span
          className={cn(
            "money text-base font-bold",
            txn.direction === "in" ? "text-[var(--in)]" : "text-[var(--out)]",
          )}
        >
          ₹{money(txn.amount)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="field sm:col-span-2 lg:col-span-4"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Remark"
        />
        <Combo
          options={parties.map((p) => ({ id: p.id, label: p.name }))}
          value={partyId}
          onChange={setPartyId}
          placeholder="Party"
          onCreate={async (name) => {
            const result = await createParty({ brand_id: brandId, name });
            if (result.error) {
              toast.error(result.error);
              return null;
            }
            return result.id ?? null;
          }}
        />
        <Combo
          options={categories.map((c) => ({ id: c.id, label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Category"
          onCreate={async (name) => {
            const result = await createCategory({ brand_id: brandId, name });
            if (result.error) {
              toast.error(result.error);
              return null;
            }
            return result.id ?? null;
          }}
        />
        <Combo
          options={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
          value={modeId}
          onChange={setModeId}
          placeholder="Payment mode"
        />
        <button className="btn btn-accent" onClick={confirm} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Confirm
        </button>
      </div>
    </GlassCard>
  );
}
