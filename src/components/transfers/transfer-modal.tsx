"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, Modal } from "@/components/ui";
import { createTransfer } from "@/app/actions/transactions";
import { cn, money, todayISO } from "@/lib/utils";
import type { Account, Brand } from "@/lib/types";

type Mode = "accounts" | "brands";

/**
 * One form for both kinds of transfer: between two accounts of the current
 * brand (Cash → Bank deposit), or out to another brand of the company.
 * Remounted by key on open, so it always starts fresh.
 */
export function TransferModal({
  open,
  onClose,
  brandId,
  brands,
  accounts,
  initialMode = "accounts",
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  brands: Brand[];
  accounts: Account[];
  initialMode?: Mode;
}) {
  const own = accounts.filter((a) => a.brand_id === brandId);
  const otherBrands = brands.filter((b) => b.id !== brandId);

  const [mode, setMode] = useState<Mode>(otherBrands.length ? initialMode : "accounts");
  const [fromAccount, setFromAccount] = useState<string | null>(own[0]?.id ?? null);
  const [toAccount, setToAccount] = useState<string | null>(own[1]?.id ?? null);
  const [toBrand, setToBrand] = useState<string | null>(otherBrands[0]?.id ?? null);
  const [toBrandAccount, setToBrandAccount] = useState<string | null>(
    accounts.find((a) => a.brand_id === otherBrands[0]?.id)?.id ?? null,
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const targetAccounts = accounts.filter((a) => a.brand_id === toBrand);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount");
    if (!fromAccount) return toast.error("Pick the account money leaves");

    const destinationBrand = mode === "accounts" ? brandId : toBrand;
    const destinationAccount = mode === "accounts" ? toAccount : toBrandAccount;
    if (!destinationBrand || !destinationAccount) return toast.error("Pick where the money goes");
    if (mode === "accounts" && destinationAccount === fromAccount) {
      return toast.error("Pick two different accounts");
    }

    setBusy(true);
    const result = await createTransfer({
      from_brand_id: brandId,
      to_brand_id: destinationBrand,
      from_account_id: fromAccount,
      to_account_id: destinationAccount,
      amount: value,
      transfer_date: date,
      note,
    });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(`₹${money(value)} transferred`);
    onClose();
  }

  const tab = (value: Mode, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setMode(value)}
      className={cn(
        "flex-1 rounded-full border-[0.5px] py-2 text-xs transition-colors",
        mode === value
          ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
          : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
      )}
    >
      {label}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Transfer">
      <div className="flex flex-col gap-3.5">
        {otherBrands.length > 0 && (
          <div className="flex gap-1.5">
            {tab("accounts", "Between my accounts")}
            {tab("brands", "To another brand")}
          </div>
        )}

        <Field label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-[var(--fg-muted)]">
              ₹
            </span>
            <input
              className="field money !pl-8 !text-xl !font-medium"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From account">
            <Combo
              options={own.map((a) => ({ id: a.id, label: a.name, hint: a.type }))}
              value={fromAccount}
              onChange={setFromAccount}
              allowClear={false}
            />
          </Field>

          {mode === "accounts" ? (
            <Field label="To account">
              <Combo
                options={own
                  .filter((a) => a.id !== fromAccount)
                  .map((a) => ({ id: a.id, label: a.name, hint: a.type }))}
                value={toAccount}
                onChange={setToAccount}
                allowClear={false}
                placeholder="Bank"
              />
            </Field>
          ) : (
            <>
              <Field label="To brand">
                <Combo
                  options={otherBrands.map((b) => ({ id: b.id, label: b.name }))}
                  value={toBrand}
                  onChange={(id) => {
                    setToBrand(id);
                    setToBrandAccount(accounts.find((a) => a.brand_id === id)?.id ?? null);
                  }}
                  allowClear={false}
                />
              </Field>
              <Field label="Into account" className="sm:col-start-2">
                <Combo
                  options={targetAccounts.map((a) => ({ id: a.id, label: a.name, hint: a.type }))}
                  value={toBrandAccount}
                  onChange={setToBrandAccount}
                  allowClear={false}
                />
              </Field>
            </>
          )}
        </div>

        {mode === "accounts" && own.length < 2 && (
          <p className="text-xs text-[var(--warn)]">
            This brand has one account. Add another in Accounts → Settings to move money between them.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note">
            <input
              className="field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "accounts" ? "Cash deposit" : "Fund rotation"}
            />
          </Field>
        </div>

        <button className="btn btn-accent mt-1 !py-3" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          Transfer
        </button>
      </div>
    </Modal>
  );
}
