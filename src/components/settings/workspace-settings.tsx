"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateBrand } from "@/app/actions/brands";
import { Field, GlassCard, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Brand } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

function SaveButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button className="btn btn-accent mt-4" onClick={onClick} disabled={busy}>
      {busy && <Loader2 className="size-4 animate-spin" />}
      Save changes
    </button>
  );
}

/** Items workspace: defaults new products/services start with. */
export function ItemsSettings({ brand }: { brand: Brand }) {
  const [busy, setBusy] = useState(false);
  const [gst, setGst] = useState(Number(brand.item_default_gst ?? 18));
  const [unit, setUnit] = useState(brand.item_default_unit ?? "nos");

  async function save() {
    setBusy(true);
    const result = await updateBrand(brand.id, {
      item_default_gst: gst,
      item_default_unit: unit.trim() || "nos",
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Item defaults saved");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Item settings" subtitle="Defaults for new products & services" />
      <GlassCard>
        <div className="flex flex-col gap-4">
          <Field label="Default GST rate">
            <div className="flex flex-wrap gap-1.5">
              {GST_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setGst(rate)}
                  className={cn(
                    "rounded-full border-[0.5px] px-4 py-1.5 text-xs transition-colors",
                    gst === rate
                      ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                      : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                  )}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="Default unit" hint="e.g. nos, sqft, hrs, pcs">
            <input className="field max-w-xs" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
        <SaveButton busy={busy} onClick={save} />
      </GlassCard>
    </div>
  );
}

/** Quotation & Invoices workspace: what prints on documents and how they're numbered. */
export function SalesSettings({ brand }: { brand: Brand }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: brand.name,
    legal_name: brand.legal_name ?? "",
    gstin: brand.gstin ?? "",
    phone: brand.phone ?? "",
    email: brand.email ?? "",
    address: brand.address ?? "",
    invoice_prefix: brand.invoice_prefix,
    quotation_prefix: brand.quotation_prefix,
    default_notes: brand.default_notes ?? "",
    default_terms: brand.default_terms ?? "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save() {
    if (!form.name.trim()) return toast.error("Brand name is required");
    setBusy(true);
    const result = await updateBrand(brand.id, {
      ...form,
      gstin: form.gstin.trim().toUpperCase(),
      state_code: form.gstin.trim().slice(0, 2) || undefined,
      invoice_prefix: form.invoice_prefix.trim().toUpperCase() || "INV",
      quotation_prefix: form.quotation_prefix.trim().toUpperCase() || "QTN",
      default_notes: form.default_notes.trim() || null,
      default_terms: form.default_terms.trim() || null,
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Invoice settings saved");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Invoice settings" subtitle="Printed on every quotation and invoice" />

      <GlassCard>
        <p className="label-caps mb-3">Invoice header</p>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Brand name">
            <input className="field" value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Legal name">
            <input className="field" value={form.legal_name} onChange={set("legal_name")} />
          </Field>
          <Field label="GSTIN" hint="Blank = invoices default to without GST">
            <input className="field money uppercase" value={form.gstin} onChange={set("gstin")} maxLength={15} />
          </Field>
          <Field label="Phone">
            <input className="field" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <input className="field" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <textarea className="field min-h-20 resize-y" value={form.address} onChange={set("address")} />
          </Field>
        </div>
      </GlassCard>

      <GlassCard className="mt-3">
        <p className="label-caps mb-3">Numbering</p>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Invoice prefix" hint={`Next looks like ${form.invoice_prefix || "INV"}-0001`}>
            <input className="field money uppercase" value={form.invoice_prefix} onChange={set("invoice_prefix")} maxLength={10} />
          </Field>
          <Field label="Quotation prefix" hint={`Next looks like ${form.quotation_prefix || "QTN"}-0001`}>
            <input className="field money uppercase" value={form.quotation_prefix} onChange={set("quotation_prefix")} maxLength={10} />
          </Field>
        </div>
      </GlassCard>

      <GlassCard className="mt-3">
        <p className="label-caps mb-3">Defaults for new documents</p>
        <div className="grid gap-3.5">
          <Field label="Notes">
            <textarea
              className="field min-h-16 resize-y"
              value={form.default_notes}
              onChange={set("default_notes")}
              placeholder="Thank you for your business!"
            />
          </Field>
          <Field label="Terms">
            <textarea
              className="field min-h-20 resize-y"
              value={form.default_terms}
              onChange={set("default_terms")}
              placeholder="Payment due within 15 days. Bank details: …"
            />
          </Field>
        </div>
        <SaveButton busy={busy} onClick={save} />
      </GlassCard>
    </div>
  );
}
