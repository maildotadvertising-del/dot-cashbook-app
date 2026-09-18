"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight, Loader2, Plus } from "lucide-react";
import { Combo } from "@/components/combo";
import { EmptyState, Field, GlassCard, Modal, PageHeader } from "@/components/ui";
import { createTransfer } from "@/app/actions/transactions";
import { formatDate, money, todayISO } from "@/lib/utils";
import type { Account, Brand, Transfer } from "@/lib/types";

export function TransfersView({
  brands,
  accounts,
  transfers,
  defaultFromBrand,
}: {
  brands: Brand[];
  accounts: Account[];
  transfers: Transfer[];
  defaultFromBrand?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fromBrand, setFromBrand] = useState<string | null>(defaultFromBrand ?? brands[0]?.id ?? null);
  const [toBrand, setToBrand] = useState<string | null>(
    brands.find((b) => b.id !== (defaultFromBrand ?? brands[0]?.id))?.id ?? null,
  );
  const [fromAccount, setFromAccount] = useState<string | null>(null);
  const [toAccount, setToAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const fromAccounts = accounts.filter((a) => a.brand_id === fromBrand);
  const toAccounts = accounts.filter((a) => a.brand_id === toBrand);
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";

  useEffect(() => {
    setFromAccount(fromAccounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBrand]);

  useEffect(() => {
    setToAccount(toAccounts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toBrand]);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount");
    if (!fromBrand || !toBrand) return toast.error("Pick both brands");
    if (fromBrand === toBrand) return toast.error("Pick two different brands");
    if (!fromAccount || !toAccount) return toast.error("Pick both accounts");

    setBusy(true);
    const result = await createTransfer({
      from_brand_id: fromBrand,
      to_brand_id: toBrand,
      from_account_id: fromAccount,
      to_account_id: toAccount,
      amount: value,
      transfer_date: date,
      note,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(`₹${money(value)} transferred`);
    setOpen(false);
    setAmount("");
    setNote("");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Fund Transfers"
        subtitle="Move money between brands — both cash books update together"
        actions={
          <button
            className="btn btn-accent"
            onClick={() => setOpen(true)}
            disabled={brands.length < 2}
          >
            <Plus className="size-4" /> New transfer
          </button>
        }
      />

      {brands.length < 2 ? (
        <GlassCard>
          <EmptyState
            icon={<ArrowLeftRight className="size-9" />}
            title="Add a second brand first"
            description="Transfers move money from one brand's book to another, so you need at least two."
          />
        </GlassCard>
      ) : !transfers.length ? (
        <GlassCard>
          <EmptyState
            icon={<ArrowLeftRight className="size-9" />}
            title="No transfers yet"
            description="A transfer posts a Cash Out in the sending brand and a matching Cash In in the receiving brand."
            action={
              <button className="btn btn-accent" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> New transfer
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {transfers.map((t) => (
            <GlassCard key={t.id} className="flex flex-wrap items-center gap-3 !p-3.5">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span className="truncate font-semibold">{brandName(t.from_brand_id)}</span>
                <ArrowRight className="size-4 shrink-0 text-[var(--fg-muted)]" />
                <span className="truncate font-semibold">{brandName(t.to_brand_id)}</span>
              </span>
              <span className="text-right">
                <span className="money block text-sm font-bold text-[var(--accent)]">
                  ₹{money(t.amount)}
                </span>
                <span className="block text-[11px] text-[var(--fg-muted)]">
                  {formatDate(t.transfer_date)}
                </span>
              </span>
              {t.note && (
                <span className="w-full truncate text-xs text-[var(--fg-muted)]">{t.note}</span>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Transfer funds">
        <div className="flex flex-col gap-3.5">
          <Field label="Amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--fg-muted)]">
                ₹
              </span>
              <input
                className="field money !pl-8 !text-xl !font-bold"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From brand">
              <Combo
                options={brands.map((b) => ({ id: b.id, label: b.name }))}
                value={fromBrand}
                onChange={setFromBrand}
                allowClear={false}
              />
            </Field>
            <Field label="From account">
              <Combo
                options={fromAccounts.map((a) => ({ id: a.id, label: a.name }))}
                value={fromAccount}
                onChange={setFromAccount}
                allowClear={false}
              />
            </Field>
            <Field label="To brand">
              <Combo
                options={brands
                  .filter((b) => b.id !== fromBrand)
                  .map((b) => ({ id: b.id, label: b.name }))}
                value={toBrand}
                onChange={setToBrand}
                allowClear={false}
              />
            </Field>
            <Field label="To account">
              <Combo
                options={toAccounts.map((a) => ({ id: a.id, label: a.name }))}
                value={toAccount}
                onChange={setToAccount}
                allowClear={false}
              />
            </Field>
          </div>

          <Field label="Date">
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Note">
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What is this transfer for?"
            />
          </Field>

          <button className="btn btn-accent mt-1" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Transfer funds
          </button>
        </div>
      </Modal>
    </div>
  );
}
