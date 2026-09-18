"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2, Plus, Search, Users } from "lucide-react";
import { createParty } from "@/app/actions/masters";
import { EmptyState, Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import { exportRows } from "@/lib/export";
import { cn, money } from "@/lib/utils";
import type { Brand, Party, PartyType } from "@/lib/types";

type PartyWithBalance = Party & { balance: number };

export function PartiesView({
  brand,
  parties,
}: {
  brand: Brand;
  parties: PartyWithBalance[];
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "customer" | "supplier">("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "customer" as PartyType,
    phone: "",
    email: "",
    gstin: "",
    address: "",
    opening_balance: "",
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return parties.filter((p) => {
      const matchesTab =
        tab === "all" || p.type === tab || p.type === "both";
      const matchesTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.phone?.includes(term) ||
        p.gstin?.toLowerCase().includes(term);
      return matchesTab && matchesTerm;
    });
  }, [parties, search, tab]);

  const receivable = parties.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const payable = parties.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0);

  async function save() {
    if (!form.name.trim()) return toast.error("Enter a name");
    setBusy(true);
    const result = await createParty({
      brand_id: brand.id,
      name: form.name,
      type: form.type,
      phone: form.phone,
      email: form.email,
      gstin: form.gstin,
      address: form.address,
      opening_balance: Number(form.opening_balance) || 0,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(`${form.name} added`);
    setOpen(false);
    setForm({ name: "", type: "customer", phone: "", email: "", gstin: "", address: "", opening_balance: "" });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Parties"
        subtitle={`${parties.length} contacts · ₹${money(receivable)} receivable · ₹${money(payable)} payable`}
        actions={
          <>
            <button
              className="btn btn-ghost"
              onClick={() =>
                exportRows(
                  `${brand.name} parties`,
                  parties.map((p) => ({
                    Name: p.name,
                    Type: p.type,
                    Phone: p.phone ?? "",
                    GSTIN: p.gstin ?? "",
                    Balance: p.balance,
                  })),
                )
              }
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button className="btn btn-accent" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add party
            </button>
          </>
        }
      />

      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              className="field !pl-9"
              placeholder="Search by name, phone or GSTIN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="glass flex gap-1 rounded-full p-1">
            {(["all", "customer", "supplier"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setTab(option)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                  tab === option ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="mt-4">
        {!filtered.length ? (
          <GlassCard>
            <EmptyState
              icon={<Users className="size-9" />}
              title={parties.length ? "No match" : "No parties yet"}
              description={
                parties.length
                  ? "Try a different search."
                  : "Add customers and suppliers to track who owes what."
              }
              action={
                !parties.length ? (
                  <button className="btn btn-accent" onClick={() => setOpen(true)}>
                    <Plus className="size-4" /> Add party
                  </button>
                ) : undefined
              }
            />
          </GlassCard>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/b/${brand.id}/parties/${p.id}`}
                className="glass glass-hover card rise flex items-center gap-3 !p-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    <Pill tone="neutral">{p.type}</Pill>
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">
                    {p.phone || p.gstin || "—"}
                  </span>
                </span>
                <span className="text-right">
                  <span
                    className={cn(
                      "money block text-sm font-bold",
                      p.balance > 0
                        ? "text-[var(--in)]"
                        : p.balance < 0
                          ? "text-[var(--out)]"
                          : "text-[var(--fg-muted)]",
                    )}
                  >
                    ₹{money(Math.abs(p.balance))}
                  </span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">
                    {p.balance > 0 ? "to collect" : p.balance < 0 ? "to pay" : "settled"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add party">
        <div className="flex flex-col gap-3.5">
          <Field label="Name">
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Party name"
              autoFocus
            />
          </Field>

          <Field label="Type">
            <div className="glass grid grid-cols-3 gap-1 rounded-full p-1">
              {(["customer", "supplier", "both"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, type: option })}
                  className={cn(
                    "rounded-full py-1.5 text-xs font-semibold capitalize transition",
                    form.type === option ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                className="field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="GSTIN">
              <input
                className="field uppercase"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                maxLength={15}
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              className="field"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>

          <Field label="Address">
            <textarea
              className="field min-h-16 resize-y"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <Field
            label="Opening balance"
            hint="Positive = they owe you, negative = you owe them"
          >
            <input
              className="field money"
              type="number"
              step="0.01"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              placeholder="0.00"
            />
          </Field>

          <button className="btn btn-accent mt-1" onClick={save} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Add party
          </button>
        </div>
      </Modal>
    </div>
  );
}
