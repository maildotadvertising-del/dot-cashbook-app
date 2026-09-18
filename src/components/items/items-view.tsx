"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus, Search } from "lucide-react";
import { saveItem } from "@/app/actions/items";
import { EmptyState, Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import { cn, money } from "@/lib/utils";
import type { Brand, Item } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

function blankForm(brand: Brand) {
  return {
    id: undefined as string | undefined,
    name: "",
    kind: "service" as "product" | "service",
    description: "",
    hsn_sac: "",
    unit: brand.item_default_unit || "nos",
    purchase_rate: "",
    rate: "",
    gst_rate: String(brand.item_default_gst ?? 18),
  };
}

/** Margin on sale price; null when there's nothing to compare. */
function margin(purchase: number, sale: number) {
  if (!sale || !purchase) return null;
  return ((sale - purchase) / sale) * 100;
}

export function ItemsView({
  brand,
  items,
  canWrite,
}: {
  brand: Brand;
  items: Item[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "product" | "service">("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => blankForm(brand));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (!term || i.name.toLowerCase().includes(term) || i.hsn_sac?.toLowerCase().includes(term)),
    );
  }, [items, search, kind]);

  function startNew() {
    setForm(blankForm(brand));
    setOpen(true);
  }

  function edit(item: Item) {
    setForm({
      id: item.id,
      name: item.name,
      kind: item.kind,
      description: item.description ?? "",
      hsn_sac: item.hsn_sac ?? "",
      unit: item.unit,
      purchase_rate: String(item.purchase_rate ?? 0),
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
      purchase_rate: Number(form.purchase_rate) || 0,
      rate: Number(form.rate) || 0,
      gst_rate: Number(form.gst_rate) || 0,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(form.id ? "Item updated" : `${form.name} added`);
    setOpen(false);
  }

  const formMargin = margin(Number(form.purchase_rate), Number(form.rate));

  return (
    <div>
      <PageHeader
        title="Products & Services"
        subtitle={`${items.length} items · ${brand.name}`}
        actions={
          canWrite && (
            <button className="btn btn-accent" onClick={startNew}>
              <Plus className="size-4" /> Add item
            </button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            className="field !pl-9"
            placeholder="Search name or HSN/SAC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "product", "service"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setKind(option)}
              className={cn(
                "rounded-full border-[0.5px] px-3.5 py-1.5 text-xs capitalize transition-colors",
                kind === option
                  ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                  : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
              )}
            >
              {option === "all" ? "All" : `${option}s`}
            </button>
          ))}
        </div>
      </div>

      {!filtered.length ? (
        <GlassCard>
          <EmptyState
            icon={<Package className="size-9" />}
            title={items.length ? "No match" : "No items yet"}
            description="Add what you buy and sell. Purchase price fills purchase bills, sale price fills quotations and invoices."
            action={
              !items.length && canWrite ? (
                <button className="btn btn-accent" onClick={startNew}>
                  <Plus className="size-4" /> Add item
                </button>
              ) : undefined
            }
          />
        </GlassCard>
      ) : (
        <>
          {/* phone / tablet */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:hidden">
            {filtered.map((item) => {
              const m = margin(Number(item.purchase_rate), Number(item.rate));
              return (
                <button
                  key={item.id}
                  onClick={() => canWrite && edit(item)}
                  className="glass glass-hover card rise text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                        {item.hsn_sac ? `HSN ${item.hsn_sac} · ` : ""}
                        {Number(item.gst_rate)}% GST · per {item.unit}
                      </span>
                    </span>
                    <Pill tone={item.kind === "product" ? "special" : "accent"}>{item.kind}</Pill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t-[0.5px] border-[var(--hairline)] pt-2.5">
                    <Price label="Purchase" value={Number(item.purchase_rate)} />
                    <Price label="Sale" value={Number(item.rate)} tone="in" />
                    <div>
                      <p className="label-caps">Margin</p>
                      <p className={cn("money text-sm", m === null ? "text-[var(--fg-subtle)]" : m >= 0 ? "text-[var(--in)]" : "text-[var(--out)]")}>
                        {m === null ? "—" : `${m.toFixed(1)}%`}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* desktop */}
          <GlassCard className="hidden !p-0 lg:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-[var(--hairline)] text-left">
                  <th className="label-caps px-4 py-3">Item</th>
                  <th className="label-caps px-4 py-3">Type</th>
                  <th className="label-caps px-4 py-3">HSN / SAC</th>
                  <th className="label-caps px-4 py-3">GST</th>
                  <th className="label-caps px-4 py-3 text-right">Purchase</th>
                  <th className="label-caps px-4 py-3 text-right">Sale</th>
                  <th className="label-caps px-4 py-3 text-right">Margin</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const m = margin(Number(item.purchase_rate), Number(item.rate));
                  return (
                    <tr key={item.id} className="border-b-[0.5px] border-[rgba(255,255,255,0.04)] font-light last:border-0 hover:bg-white/[0.015]">
                      <td className="px-4 py-3">
                        <div className="font-normal">{item.name}</div>
                        <div className="text-[11px] text-[var(--fg-muted)]">per {item.unit}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={item.kind === "product" ? "special" : "accent"}>{item.kind}</Pill>
                      </td>
                      <td className="money px-4 py-3 text-[var(--fg-muted)]">{item.hsn_sac ?? "—"}</td>
                      <td className="money px-4 py-3">{Number(item.gst_rate)}%</td>
                      <td className="money px-4 py-3 text-right">₹{money(item.purchase_rate)}</td>
                      <td className="money px-4 py-3 text-right text-[var(--in)]">₹{money(item.rate)}</td>
                      <td className={cn("money px-4 py-3 text-right", m === null ? "text-[var(--fg-subtle)]" : m >= 0 ? "text-[var(--in)]" : "text-[var(--out)]")}>
                        {m === null ? "—" : `${m.toFixed(1)}%`}
                      </td>
                      <td className="px-2">
                        {canWrite && (
                          <button
                            onClick={() => edit(item)}
                            className="grid size-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-white/5 hover:text-[var(--accent)]"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? "Edit item" : "Add item"}>
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
            <div className="flex gap-1.5">
              {(["service", "product"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, kind: option })}
                  className={cn(
                    "flex-1 rounded-full border-[0.5px] py-2 text-xs capitalize transition-colors",
                    form.kind === option
                      ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                      : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price" hint="Used on purchase bills">
              <input
                className="field money"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.purchase_rate}
                onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Sale price" hint="Used on quotations & invoices">
              <input
                className="field money"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </div>

          {formMargin !== null && (
            <p className={cn("-mt-1 text-xs", formMargin >= 0 ? "text-[var(--in)]" : "text-[var(--out)]")}>
              Margin ₹{money(Number(form.rate) - Number(form.purchase_rate))} ({formMargin.toFixed(1)}%)
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <input
                className="field"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="nos, sqft, hrs"
              />
            </Field>
            <Field label="HSN / SAC">
              <input
                className="field money"
                value={form.hsn_sac}
                onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })}
                placeholder="998361"
              />
            </Field>
          </div>

          <Field label="GST rate">
            <div className="flex flex-wrap gap-1.5">
              {GST_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setForm({ ...form, gst_rate: String(rate) })}
                  className={cn(
                    "rounded-full border-[0.5px] px-3.5 py-1.5 text-xs transition-colors",
                    Number(form.gst_rate) === rate
                      ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                      : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                  )}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </Field>

          <Field label="Description">
            <textarea
              className="field min-h-16 resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Shown on the invoice under the item name"
            />
          </Field>

          <button className="btn btn-accent mt-1 !py-3" onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {form.id ? "Save changes" : "Add item"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Price({ label, value, tone }: { label: string; value: number; tone?: "in" }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className={cn("money text-sm", tone === "in" && "text-[var(--in)]")}>₹{money(value)}</p>
    </div>
  );
}
