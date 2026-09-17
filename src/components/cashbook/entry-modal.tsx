"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Paperclip, Trash2, X } from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, Modal } from "@/components/ui";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/app/actions/transactions";
import { createCategory, createParty, createPaymentMode } from "@/app/actions/masters";
import { receiptUrl, uploadReceipt } from "@/lib/receipts";
import { cn, todayISO } from "@/lib/utils";
import type {
  Account,
  Category,
  Direction,
  PaymentMode,
  Party,
  TransactionRow,
} from "@/lib/types";

export function EntryModal({
  open,
  onClose,
  brandId,
  direction,
  entry,
  accounts,
  categories,
  parties,
  paymentModes,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  direction: Direction;
  entry?: TransactionRow | null;
  accounts: Account[];
  categories: Category[];
  parties: Party[];
  paymentModes: PaymentMode[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState<Direction>(direction);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [remark, setRemark] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [modeId, setModeId] = useState<string | null>(null);
  const [billUrl, setBillUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDir(entry?.direction ?? direction);
    setAmount(entry ? String(entry.amount) : "");
    setDate(entry?.txn_date ?? todayISO());
    setRemark(entry?.remark ?? "");
    setAccountId(entry?.account_id ?? accounts[0]?.id ?? null);
    setPartyId(entry?.party_id ?? null);
    setCategoryId(entry?.category_id ?? null);
    setModeId(entry?.payment_mode_id ?? null);
    setBillUrl(entry?.bill_url ?? null);
  }, [open, entry, direction, accounts]);

  async function save() {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount");
    if (!accountId) return toast.error("Pick an account");

    setBusy(true);
    const payload = {
      brand_id: brandId,
      account_id: accountId,
      direction: dir,
      amount: value,
      txn_date: date,
      remark,
      party_id: partyId,
      category_id: categoryId,
      payment_mode_id: modeId,
      bill_url: billUrl,
    };

    const result = entry
      ? await updateTransaction(entry.id, payload)
      : await createTransaction(payload);
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(entry ? "Entry updated" : `₹${value.toLocaleString("en-IN")} saved`);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!entry) return;
    setBusy(true);
    const result = await deleteTransaction(entry.id);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Entry deleted");
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit entry" : "New entry"}>
      <div className="flex flex-col gap-3.5">
        <div className="glass grid grid-cols-2 gap-1 rounded-full p-1">
          {(["in", "out"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDir(option)}
              className={cn(
                "rounded-full py-2 text-sm font-semibold transition",
                dir === option
                  ? option === "in"
                    ? "bg-[var(--in)] text-white"
                    : "bg-[var(--out)] text-white"
                  : "text-[var(--fg-muted)]",
              )}
            >
              {option === "in" ? "Cash In" : "Cash Out"}
            </button>
          ))}
        </div>

        <Field label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--fg-muted)]">
              ₹
            </span>
            <input
              className="field money !pl-8 !text-xl !font-bold"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          <Field label="Account">
            <Combo
              options={accounts.map((a) => ({ id: a.id, label: a.name }))}
              value={accountId}
              onChange={setAccountId}
              allowClear={false}
              placeholder="Cash"
            />
          </Field>
        </div>

        <Field label="Remark">
          <input
            className="field"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="What was this for?"
          />
        </Field>

        <Field label="Party">
          <Combo
            options={parties.map((p) => ({ id: p.id, label: p.name, hint: p.type }))}
            value={partyId}
            onChange={setPartyId}
            placeholder="Customer or supplier"
            onCreate={async (name) => {
              const result = await createParty({ brand_id: brandId, name });
              if (result.error) {
                toast.error(result.error);
                return null;
              }
              router.refresh();
              return result.id ?? null;
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
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
                router.refresh();
                return result.id ?? null;
              }}
            />
          </Field>

          <Field label="Payment mode">
            <Combo
              options={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
              value={modeId}
              onChange={setModeId}
              placeholder="Mode"
              onCreate={async (name) => {
                const result = await createPaymentMode({ brand_id: brandId, name });
                if (result.error) {
                  toast.error(result.error);
                  return null;
                }
                router.refresh();
                return result.id ?? null;
              }}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          {billUrl ? (
            <>
              <button
                type="button"
                className="btn btn-ghost min-w-0 flex-1 justify-start"
                onClick={async () => {
                  const url = await receiptUrl(billUrl);
                  if (url) window.open(url, "_blank", "noopener");
                  else toast.error("Couldn't open the attachment");
                }}
              >
                <Paperclip className="size-4" />
                <span className="truncate">View bill</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost !px-3"
                onClick={() => setBillUrl(null)}
                aria-label="Remove bill"
              >
                <X className="size-4" />
              </button>
            </>
          ) : (
            <label className="btn btn-ghost flex-1 cursor-pointer justify-start">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              {uploading ? "Uploading…" : "Attach bill photo"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  try {
                    setBillUrl(await uploadReceipt(brandId, file));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2">
          {entry && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="btn btn-ghost !px-3 text-[var(--out)]"
              aria-label="Delete entry"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || uploading}
            className={cn("btn flex-1", dir === "in" ? "btn-in" : "btn-out")}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {entry ? "Save changes" : dir === "in" ? "Add Cash In" : "Add Cash Out"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
