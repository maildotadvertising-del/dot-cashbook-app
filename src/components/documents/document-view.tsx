"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRightLeft,
  BanknoteArrowUp,
  Loader2,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, GlassCard, Modal, Pill } from "@/components/ui";
import {
  convertQuotation,
  deleteDocument,
  recordPayment,
  setDocumentStatus,
} from "@/app/actions/documents";
import { amountInWords, formatDate, money, todayISO } from "@/lib/utils";
import type {
  Account,
  Brand,
  DocumentLine,
  DocumentRecord,
  Party,
  PaymentMode,
} from "@/lib/types";

export function DocumentView({
  brand,
  doc,
  lines,
  party,
  accounts,
  paymentModes,
  payments,
}: {
  brand: Brand;
  doc: DocumentRecord;
  lines: DocumentLine[];
  party: Party | null;
  accounts: Account[];
  paymentModes: PaymentMode[];
  payments: { id: string; amount: number; paid_on: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const due = Number(doc.total) - Number(doc.amount_paid);
  const [payAmount, setPayAmount] = useState(String(due > 0 ? due : ""));
  const [payDate, setPayDate] = useState(todayISO());
  const [payAccount, setPayAccount] = useState<string | null>(accounts[0]?.id ?? null);
  const [payMode, setPayMode] = useState<string | null>(null);

  const isQuotation = doc.doc_type === "quotation";
  const base = isQuotation ? "quotations" : "invoices";
  const label = isQuotation ? "Quotation" : "Invoice";

  async function pay() {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");

    setBusy(true);
    const result = await recordPayment({
      document_id: doc.id,
      amount,
      paid_on: payDate,
      account_id: payAccount,
      payment_mode_id: payMode,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success("Payment recorded");
    setPayOpen(false);
    router.refresh();
  }

  async function convert() {
    setBusy(true);
    const result = await convertQuotation(doc.id);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Invoice created");
    router.push(`/b/${brand.id}/invoices/${result.id}`);
  }

  async function remove() {
    setBusy(true);
    const result = await deleteDocument(doc.id);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success(`${label} deleted`);
    router.push(`/b/${brand.id}/${base}`);
  }

  async function markSent() {
    setBusy(true);
    await setDocumentStatus(doc.id, "sent");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/b/${brand.id}/${base}`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="size-4" /> {label}s
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {doc.status === "draft" && (
            <button className="btn btn-ghost" onClick={markSent} disabled={busy}>
              Mark sent
            </button>
          )}
          {isQuotation ? (
            <button className="btn btn-accent" onClick={convert} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}
              Convert to invoice
            </button>
          ) : (
            due > 0 && (
              <button className="btn btn-in" onClick={() => setPayOpen(true)}>
                <BanknoteArrowUp className="size-4" /> Record payment
              </button>
            )
          )}
          <Link href={`/b/${brand.id}/${base}/${doc.id}/edit`} className="btn btn-ghost">
            <Pencil className="size-4" />
          </Link>
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Printer className="size-4" />
          </button>
          <button className="btn btn-ghost text-[var(--out)]" onClick={remove} disabled={busy}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------- printable surface */}
      <div className="glass-strong card rise !p-6 print:!border-0 print:!bg-white print:!shadow-none print:backdrop-filter-none lg:!p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {brand.legal_name || brand.name}
            </h1>
            {brand.address && (
              <p className="mt-0.5 max-w-xs whitespace-pre-line text-xs text-[var(--fg-muted)]">
                {brand.address}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              {brand.phone && <span>{brand.phone}</span>}
              {brand.phone && brand.email && " · "}
              {brand.email}
            </p>
            {doc.is_gst && brand.gstin && (
              <p className="mt-1 text-xs font-semibold">GSTIN: {brand.gstin}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              {doc.is_gst ? `Tax ${label}` : label}
            </p>
            <p className="text-xl font-bold">{doc.doc_number}</p>
            <p className="text-xs text-[var(--fg-muted)]">{formatDate(doc.doc_date)}</p>
            {doc.due_date && (
              <p className="text-xs text-[var(--fg-muted)]">
                {isQuotation ? "Valid until" : "Due"} {formatDate(doc.due_date)}
              </p>
            )}
            <div className="no-print mt-1.5 flex justify-end">
              <Pill tone={doc.status === "paid" ? "in" : doc.status === "draft" ? "neutral" : "accent"}>
                {doc.status}
              </Pill>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--hairline)] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
            {isQuotation ? "Quotation for" : "Bill to"}
          </p>
          <p className="mt-1 font-semibold">{party?.name ?? "—"}</p>
          {party?.address && (
            <p className="max-w-sm whitespace-pre-line text-xs text-[var(--fg-muted)]">
              {party.address}
            </p>
          )}
          {party?.phone && <p className="text-xs text-[var(--fg-muted)]">{party.phone}</p>}
          {doc.is_gst && party?.gstin && (
            <p className="mt-0.5 text-xs font-semibold">GSTIN: {party.gstin}</p>
          )}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-y border-[var(--hairline)] text-left text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Item</th>
                {doc.is_gst && <th className="py-2 pr-2 font-semibold">HSN</th>}
                <th className="py-2 pr-2 text-right font-semibold">Qty</th>
                <th className="py-2 pr-2 text-right font-semibold">Rate</th>
                {doc.is_gst && <th className="py-2 pr-2 text-right font-semibold">GST</th>}
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-b border-[var(--hairline)]">
                  <td className="py-2.5 pr-2 text-[var(--fg-muted)]">{index + 1}</td>
                  <td className="py-2.5 pr-2">
                    <div className="font-medium">{line.name}</div>
                    {line.description && (
                      <div className="text-xs text-[var(--fg-muted)]">{line.description}</div>
                    )}
                  </td>
                  {doc.is_gst && (
                    <td className="py-2.5 pr-2 text-xs text-[var(--fg-muted)]">
                      {line.hsn_sac ?? "—"}
                    </td>
                  )}
                  <td className="money py-2.5 pr-2 text-right">
                    {Number(line.qty)} {line.unit}
                  </td>
                  <td className="money py-2.5 pr-2 text-right">₹{money(line.rate)}</td>
                  {doc.is_gst && (
                    <td className="money py-2.5 pr-2 text-right">{Number(line.gst_rate)}%</td>
                  )}
                  <td className="money py-2.5 text-right font-semibold">₹{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="max-w-xs text-xs">
            <p className="font-semibold">Amount in words</p>
            <p className="text-[var(--fg-muted)]">{amountInWords(Number(doc.total))}</p>

            {doc.notes && (
              <>
                <p className="mt-3 font-semibold">Notes</p>
                <p className="whitespace-pre-line text-[var(--fg-muted)]">{doc.notes}</p>
              </>
            )}
            {doc.terms && (
              <>
                <p className="mt-3 font-semibold">Terms</p>
                <p className="whitespace-pre-line text-[var(--fg-muted)]">{doc.terms}</p>
              </>
            )}
          </div>

          <dl className="min-w-[220px] text-sm">
            <Row label="Subtotal" value={Number(doc.subtotal)} />
            {Number(doc.discount) > 0 && <Row label="Discount" value={-Number(doc.discount)} />}
            {Number(doc.cgst) > 0 && <Row label="CGST" value={Number(doc.cgst)} />}
            {Number(doc.sgst) > 0 && <Row label="SGST" value={Number(doc.sgst)} />}
            {Number(doc.igst) > 0 && <Row label="IGST" value={Number(doc.igst)} />}
            {Number(doc.round_off) !== 0 && <Row label="Round off" value={Number(doc.round_off)} />}
            <div className="mt-1 flex items-center justify-between border-t border-[var(--hairline)] pt-2.5">
              <dt className="font-bold">Total</dt>
              <dd className="money text-lg font-bold">₹{money(doc.total)}</dd>
            </div>
            {Number(doc.amount_paid) > 0 && (
              <>
                <Row label="Paid" value={Number(doc.amount_paid)} />
                <div className="flex items-center justify-between font-semibold text-[var(--out)]">
                  <dt>Balance due</dt>
                  <dd className="money">₹{money(due)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        <div className="mt-10 flex justify-end">
          <div className="text-center text-xs text-[var(--fg-muted)]">
            <div className="mb-1 h-10" />
            <div className="border-t border-[var(--hairline)] px-8 pt-1">
              For {brand.legal_name || brand.name}
            </div>
          </div>
        </div>
      </div>

      {!!payments.length && (
        <GlassCard className="no-print mt-3">
          <h2 className="mb-2 text-sm font-semibold">Payments</h2>
          <div className="flex flex-col divide-y divide-[var(--hairline)]">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[var(--fg-muted)]">{formatDate(p.paid_on)}</span>
                <span className="money font-semibold text-[var(--in)]">₹{money(p.amount)}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record payment">
        <div className="flex flex-col gap-3.5">
          <Field label="Amount">
            <input
              className="field money"
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Date">
            <input
              className="field"
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </Field>
          <Field label="Deposit into" hint="Also posts a matching cash book entry">
            <Combo
              options={accounts.map((a) => ({ id: a.id, label: a.name }))}
              value={payAccount}
              onChange={setPayAccount}
              placeholder="Skip ledger entry"
            />
          </Field>
          <Field label="Payment mode">
            <Combo
              options={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
              value={payMode}
              onChange={setPayMode}
              placeholder="Mode"
            />
          </Field>
          <button className="btn btn-in mt-1" onClick={pay} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Record payment
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="money">₹{money(value)}</dd>
    </div>
  );
}
