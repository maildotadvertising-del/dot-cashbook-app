"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createBrand } from "@/app/actions/brands";
import { Field, GlassCard, PageHeader } from "@/components/ui";

export default function NewBrandPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    gstin: "",
    phone: "",
    email: "",
    address: "",
    invoice_prefix: "INV",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const result = await createBrand(form);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${form.name} added`);
    router.push(`/b/${result.brandId}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Add a brand"
        subtitle="Each brand keeps its own cash book, parties, and invoices."
      />

      <GlassCard>
        <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Brand name" className="sm:col-span-2">
            <input
              className="field"
              value={form.name}
              onChange={set("name")}
              placeholder="DOT Advertising"
              required
              autoFocus
            />
          </Field>

          <Field label="Legal name" hint="As printed on invoices">
            <input
              className="field"
              value={form.legal_name}
              onChange={set("legal_name")}
              placeholder="Soft Dreamz Multimedia"
            />
          </Field>

          <Field label="GSTIN" hint="Leave blank for non-GST brands">
            <input
              className="field uppercase"
              value={form.gstin}
              onChange={set("gstin")}
              placeholder="33ABCDE1234F1Z5"
              maxLength={15}
            />
          </Field>

          <Field label="Phone">
            <input className="field" value={form.phone} onChange={set("phone")} placeholder="98765 43210" />
          </Field>

          <Field label="Email">
            <input className="field" type="email" value={form.email} onChange={set("email")} placeholder="brand@company.com" />
          </Field>

          <Field label="Address" className="sm:col-span-2">
            <textarea
              className="field min-h-20 resize-y"
              value={form.address}
              onChange={set("address")}
              placeholder="No.159, Mahadhana Street, Mayiladuthurai, Tamil Nadu, 609001"
            />
          </Field>

          <Field label="Invoice prefix" hint="Invoice numbers look like INV-0001">
            <input
              className="field uppercase"
              value={form.invoice_prefix}
              onChange={set("invoice_prefix")}
              maxLength={8}
            />
          </Field>

          <div className="flex items-end sm:col-span-2">
            <button className="btn btn-accent w-full sm:w-auto" disabled={busy || !form.name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Create brand
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
