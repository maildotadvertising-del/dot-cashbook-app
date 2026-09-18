"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus, Search } from "lucide-react";
import { saveItem } from "@/app/actions/items";
import { EmptyState, Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import { cn, money } from "@/lib/utils";
import type { Brand, Item } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

const BLANK = {
  id: undefined as string | undefined,
  name: "",
  kind: "service" as "product" | "service",
  description: "",
  hsn_sac: "",
  unit: "nos",
  rate: "",
  gst_rate: "18",
};

export function ItemsView({ brand, items }: { brand: Brand; items: Item[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(BLANK);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        i.hsn_sac?.toLowerCase().includes(term),
    );
  }, [items, search]);

  function edit(item: Item) {
    setForm({
      id: item.id,
      name: item.name,
      kind: item.kind,
      description: item.description ?? "",
      hsn_sac: item.hsn_sac ?? "",
      unit: item.unit,
      rate: String(item.rate),
      gst_rate: String(item.gst_rate),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Enter a name");
    setBusy(true);
    const result = await saveItem({
      id: form.id,
      brand_id: brand.id,
      name: form.name,
      kind: form.kind,
      description: form.description,
      hsn_sac: form.hsn_sac,
      unit: form.unit,
      rate: Number(form.rate) || 0,
      gst_rate: Number(form.gst_rate) || 0,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(form.id ? "Item updated" : `${form.name} added`);
    setOpen(false);
    setForm(BLANK);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Items"
        subtitle="Products and services you bill for"
        actions={
          <button
            className="btn btn-accent"
            onClick={() => {
              setForm(BLANK);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Add item
          </button>
        }
      />

      <GlassCard className="!p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            className="field !pl-9"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </GlassCard>

      <div className="mt-4">
        {!filtered.length ? (
          <GlassCard>
            <EmptyState
              icon={<Package className="size-9" />}
              title={items.length ? "No match" : "No items yet"}
              description="Add the products or services you sell, with rate and GST, so invoices fill themselves."
              action={
                !items.length ? (
                  <button
                    className="btn btn-accent"
                    onClick={() => {
                      setForm(BLANK);
                      setOpen(true);
                    }}
                  >
                    <Plus className="size-4" /> Add item
                  </button>
                ) : undefined
              }
            />
          </GlassCard>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((item) => (
              <div key={item.id} className="glass card rise flex items-center gap-3 !p-3.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    <Pill tone="neutral">{item.kind}</Pill>
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">
                    {item.hsn_sac ? `HSN ${item.hsn_sac} · ` : ""}
                    {item.gst_rate}% GST · per {item.unit}
                  </span>
                </span>
                <span className="money shrink-0 text-sm font-bold">₹{money(item.rate)}</span>
                <button
                  onClick={() => edit(item)}
                  className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                  aria-label={`Edit ${item.name}`}
                >
                  <Pencil className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Edit item" : "Add item"}
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Name">
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Flex banner printing"
              autoFocus
            />
          </Field>

          <Field label="Type">
            <div className="glass grid grid-cols-2 gap-1 rounded-full p-1">
              {(["service", "product"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, kind: option })}
                  className={cn(
                    "rounded-full py-1.5 text-xs font-semibold capitalize transition",
                    form.kind === option ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate">
              <input
                className="field money"
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Unit">
              <input
                className="field"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="nos, sqft, hrs"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="GST rate">
              <div className="flex flex-wrap gap-1">
                {GST_RATES.map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setForm({ ...form, gst_rate: String(rate) })}
                    className={cn(
                      "rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
                      Number(form.gst_rate) === rate
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--hairline)] text-[var(--fg-muted)]",
                    )}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </Field>
            <Field label="HSN / SAC">
              <input
                className="field"
                value={form.hsn_sac}
                onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })}
                placeholder="998361"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              className="field min-h-16 resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Shown on the invoice under the item name"
            />
          </Field>

          <button className="btn btn-accent mt-1" onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {form.id ? "Save changes" : "Add item"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
