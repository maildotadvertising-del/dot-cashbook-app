"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, GlassCard, PageHeader } from "@/components/ui";
import { saveDocument, type DocumentLineInput } from "@/app/actions/documents";
import { createParty } from "@/app/actions/masters";
import { computeTotals, lineAmount, treatmentFor } from "@/lib/gst";
import { cn, money, todayISO } from "@/lib/utils";
import type { Brand, DocType, DocumentLine, DocumentRecord, Item, Party } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

interface EditorLine extends DocumentLineInput {
  key: string;
}

const blankLine = (): EditorLine => ({
  key: crypto.randomUUID(),
  name: "",
  qty: 1,
  rate: 0,
  discount_pct: 0,
  gst_rate: 18,
  unit: "nos",
});

export function DocumentEditor({
  brand,
  docType,
  parties,
  items,
  existing,
  existingLines,
}: {
  brand: Brand;
  docType: DocType;
  parties: Party[];
  items: Item[];
  existing?: DocumentRecord | null;
  existingLines?: DocumentLine[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [partyId, setPartyId] = useState<string | null>(existing?.party_id ?? null);
  const [docDate, setDocDate] = useState(existing?.doc_date ?? todayISO());
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [isGst, setIsGst] = useState(existing?.is_gst ?? Boolean(brand.gstin));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [terms, setTerms] = useState(existing?.terms ?? "");
  const [lines, setLines] = useState<EditorLine[]>(
    existingLines?.length
      ? existingLines.map((l) => ({
          key: l.id,
          item_id: l.item_id,
          name: l.name,
          description: l.description,
          hsn_sac: l.hsn_sac,
          qty: Number(l.qty),
          unit: l.unit,
          rate: Number(l.rate),
          discount_pct: Number(l.discount_pct),
          gst_rate: Number(l.gst_rate),
        }))
      : [blankLine()],
  );

  const party = parties.find((p) => p.id === partyId) ?? null;
  const treatment = useMemo(
    () => treatmentFor(brand.gstin ?? brand.state_code, party?.gstin ?? party?.state_code),
    [brand, party],
  );

  const totals = useMemo(
    () => computeTotals(lines, { isGst, treatment }),
    [lines, isGst, treatment],
  );

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function applyItem(key: string, itemId: string | null) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return updateLine(key, { item_id: null });
    updateLine(key, {
      item_id: item.id,
      name: item.name,
      description: item.description,
      hsn_sac: item.hsn_sac,
      unit: item.unit,
      rate: Number(item.rate),
      gst_rate: Number(item.gst_rate),
    });
  }

  async function submit(status: "draft" | "sent") {
    const usable = lines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (!usable.length) return toast.error("Add at least one line item");

    setBusy(true);
    const result = await saveDocument({
      id: existing?.id,
      brand_id: brand.id,
      doc_type: docType,
      doc_number: existing?.doc_number,
      party_id: partyId,
      doc_date: docDate,
      due_date: dueDate || null,
      is_gst: isGst,
      gst_treatment: treatment,
      place_of_supply: party?.state_code ?? null,
      notes,
      terms,
      status,
      lines: usable.map(({ key, ...line }) => {
        void key;
        return line;
      }),
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(`${result.doc_number ?? "Document"} saved`);
    router.push(`/b/${brand.id}/${docType === "quotation" ? "quotations" : "invoices"}/${result.id}`);
    router.refresh();
  }

  const label = docType === "quotation" ? "Quotation" : "Invoice";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={existing ? `Edit ${label.toLowerCase()}` : `New ${label.toLowerCase()}`}
        subtitle={existing?.doc_number ?? brand.name}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => submit("draft")} disabled={busy}>
              Save draft
            </button>
            <button className="btn btn-accent" onClick={() => submit("sent")} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save {label.toLowerCase()}
            </button>
          </>
        }
      />

      <GlassCard>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Party" className="sm:col-span-2">
            <Combo
              options={parties.map((p) => ({ id: p.id, label: p.name, hint: p.gstin ?? undefined }))}
              value={partyId}
              onChange={setPartyId}
              placeholder="Select customer"
              onCreate={async (name) => {
                const result = await createParty({ brand_id: brand.id, name });
                if (result.error) {
                  toast.error(result.error);
                  return null;
                }
                router.refresh();
                return result.id ?? null;
              }}
            />
          </Field>

          <Field label="Date">
            <input
              className="field"
              type="date"
              value={docDate}
              onChange={(e) => setDocDate(e.target.value)}
            />
          </Field>

          <Field label={docType === "quotation" ? "Valid until" : "Due date"}>
            <input
              className="field"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-3.5">
          <div className="glass flex gap-1 rounded-full p-1">
            {[
              { value: true, label: "With GST" },
              { value: false, label: "Without GST" },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => setIsGst(option.value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                  isGst === option.value ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isGst && (
            <span className="text-xs text-[var(--fg-muted)]">
              {treatment === "inter"
                ? "Inter-state supply — IGST applies"
                : "Intra-state supply — CGST + SGST apply"}
            </span>
          )}
        </div>
      </GlassCard>

      {/* ------------------------------------------------------------- lines */}
      <GlassCard className="mt-3 !p-0">
        <div className="hidden grid-cols-[1fr_72px_110px_78px_90px_110px_36px] gap-2 border-b border-[var(--hairline)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)] lg:grid">
          <span>Item</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Disc %</span>
          <span>GST</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div className="flex flex-col divide-y divide-[var(--hairline)]">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 p-3 lg:grid-cols-[1fr_72px_110px_78px_90px_110px_36px] lg:items-center lg:px-4"
            >
              <div className="flex flex-col gap-1.5">
                {items.length > 0 && (
                  <Combo
                    options={items.map((i) => ({
                      id: i.id,
                      label: i.name,
                      hint: `₹${money(i.rate)}`,
                    }))}
                    value={line.item_id ?? null}
                    onChange={(id) => applyItem(line.key, id)}
                    placeholder="Pick from items"
                  />
                )}
                <input
                  className="field"
                  value={line.name}
                  onChange={(e) => updateLine(line.key, { name: e.target.value })}
                  placeholder="Description"
                />
              </div>

              <label className="lg:contents">
                <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)] lg:hidden">
                  Qty
                </span>
                <input
                  className="field money"
                  type="number"
                  step="0.001"
                  value={line.qty}
                  onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) })}
                />
              </label>

              <label className="lg:contents">
                <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)] lg:hidden">
                  Rate
                </span>
                <input
                  className="field money"
                  type="number"
                  step="0.01"
                  value={line.rate}
                  onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })}
                />
              </label>

              <label className="lg:contents">
                <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)] lg:hidden">
                  Discount %
                </span>
                <input
                  className="field money"
                  type="number"
                  step="0.01"
                  value={line.discount_pct ?? 0}
                  onChange={(e) => updateLine(line.key, { discount_pct: Number(e.target.value) })}
                />
              </label>

              <label className="lg:contents">
                <span className="mb-1 block text-xs font-semibold text-[var(--fg-muted)] lg:hidden">
                  GST
                </span>
                <select
                  className="field"
                  disabled={!isGst}
                  value={line.gst_rate ?? 0}
                  onChange={(e) => updateLine(line.key, { gst_rate: Number(e.target.value) })}
                >
                  {GST_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}%
                    </option>
                  ))}
                </select>
              </label>

              <span className="money flex items-center justify-between text-sm font-semibold lg:justify-end">
                <span className="text-xs font-normal text-[var(--fg-muted)] lg:hidden">Amount</span>
                ₹{money(lineAmount(line))}
              </span>

              <button
                type="button"
                onClick={() =>
                  setLines((current) =>
                    current.length === 1
                      ? [blankLine()]
                      : current.filter((l) => l.key !== line.key),
                  )
                }
                className="justify-self-start rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)] lg:justify-self-center"
                aria-label="Remove line"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--hairline)] p-3 lg:px-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setLines((current) => [...current, blankLine()])}
          >
            <Plus className="size-4" /> Add line
          </button>
        </div>
      </GlassCard>

      {/* ------------------------------------------------------------ totals */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <GlassCard>
          <Field label="Notes">
            <textarea
              className="field min-h-20 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the customer should see"
            />
          </Field>
          <div className="mt-3">
            <Field label="Terms">
              <textarea
                className="field min-h-20 resize-y"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, delivery details…"
              />
            </Field>
          </div>
        </GlassCard>

        <GlassCard strong>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.discount > 0 && <Row label="Discount" value={-totals.discount} />}
            {isGst && totals.cgst > 0 && <Row label="CGST" value={totals.cgst} />}
            {isGst && totals.sgst > 0 && <Row label="SGST" value={totals.sgst} />}
            {isGst && totals.igst > 0 && <Row label="IGST" value={totals.igst} />}
            {totals.roundOff !== 0 && <Row label="Round off" value={totals.roundOff} />}
            <div className="mt-1 flex items-center justify-between border-t border-[var(--hairline)] pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="money text-xl font-bold">₹{money(totals.total)}</dd>
            </div>
          </dl>
        </GlassCard>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="money">₹{money(value)}</dd>
    </div>
  );
}
