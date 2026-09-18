"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import {
  createAccount,
  createCategory,
  createPaymentMode,
  deleteRecord,
} from "@/app/actions/masters";
import { createInboundAddress, setInboundAccount } from "@/app/actions/inbound";
import { cn, formatDateTime, money } from "@/lib/utils";
import type { Account, Brand, Category, CategoryRule, Label, Party, PaymentMode } from "@/lib/types";
import { LabelsPanel } from "@/components/settings/labels-panel";
import { RulesPanel } from "@/components/settings/rules-panel";

const TABS = [
  { id: "accounts", label: "Accounts" },
  { id: "categories", label: "Categories" },
  { id: "modes", label: "Payment modes" },
  { id: "labels", label: "Labels" },
  { id: "rules", label: "Auto rules" },
  { id: "integrations", label: "Integrations" },
] as const;

interface InboundAddress {
  id: string;
  address: string;
  default_account_id: string | null;
  is_active: boolean;
}

export function SettingsView({
  brand,
  accounts,
  categories,
  paymentModes,
  inbound,
  recentImports,
  labels,
  rules,
  parties,
}: {
  brand: Brand;
  accounts: Account[];
  categories: Category[];
  paymentModes: PaymentMode[];
  labels: Label[];
  rules: CategoryRule[];
  parties: Party[];
  inbound: InboundAddress[];
  recentImports: {
    id: string;
    subject: string | null;
    status: string;
    received_at: string;
    error: string | null;
  }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("accounts");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);


  const [addOpen, setAddOpen] = useState<null | "account" | "category" | "mode">(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"cash" | "bank" | "petty" | "wallet">("cash");
  const [newOpening, setNewOpening] = useState("");


  async function addRecord() {
    if (!newName.trim()) return toast.error("Enter a name");
    setBusy(true);

    const result =
      addOpen === "account"
        ? await createAccount({
            brand_id: brand.id,
            name: newName,
            type: newType,
            opening_balance: Number(newOpening) || 0,
          })
        : addOpen === "category"
          ? await createCategory({ brand_id: brand.id, name: newName })
          : await createPaymentMode({ brand_id: brand.id, name: newName });

    setBusy(false);
    if (result.error) return toast.error(result.error);

    toast.success(`${newName} added`);
    setAddOpen(null);
    setNewName("");
    setNewOpening("");
  }

  async function remove(table: string, id: string, name: string) {
    setBusy(true);
    const result = await deleteRecord(table, id, brand.id);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success(`${name} removed`);
  }

  async function generateAddress() {
    setBusy(true);
    const result = await createInboundAddress(brand.id, accounts[0]?.id ?? null);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Address created");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Account settings" subtitle="Accounts, categories, payment modes and auto-capture" />

      <div className="glass mb-4 flex flex-wrap gap-1 rounded-full p-1">
        {TABS.map((option) => (
          <button
            key={option.id}
            onClick={() => setTab(option.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              tab === option.id ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && (
        <ListCard
          title="Accounts"
          onAdd={() => {
            setNewType("cash");
            setAddOpen("account");
          }}
          items={accounts.map((a) => ({
            id: a.id,
            label: a.name,
            hint: `${a.type} · opening ₹${money(a.opening_balance)}`,
          }))}
          onRemove={(id, name) => remove("accounts", id, name)}
        />
      )}

      {tab === "categories" && (
        <ListCard
          title="Categories"
          onAdd={() => setAddOpen("category")}
          items={categories.map((c) => ({ id: c.id, label: c.name, hint: c.kind }))}
          onRemove={(id, name) => remove("categories", id, name)}
        />
      )}

      {tab === "modes" && (
        <ListCard
          title="Payment modes"
          onAdd={() => setAddOpen("mode")}
          items={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
          onRemove={(id, name) => remove("payment_modes", id, name)}
        />
      )}

      {tab === "labels" && <LabelsPanel brandId={brand.id} labels={labels} />}

      {tab === "rules" && (
        <RulesPanel
          brandId={brand.id}
          rules={rules}
          categories={categories}
          parties={parties}
          paymentModes={paymentModes}
          labels={labels}
        />
      )}

      {tab === "integrations" && (
        <div className="flex flex-col gap-3">
          <GlassCard>
            <div className="mb-1 flex items-center gap-2">
              <Mail className="size-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold">UPI &amp; bank auto-capture</h2>
            </div>
            <p className="text-sm text-[var(--fg-muted)]">
              Forward your bank&apos;s transaction alert emails to the address below. Each alert
              becomes a cash book entry automatically, with the UPI note and amount filled in.
            </p>

            {!inbound.length ? (
              <button className="btn btn-accent mt-3" onClick={generateAddress} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create forwarding address
              </button>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {inbound.map((entry) => (
                  <div key={entry.id} className="glass rounded-[16px] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="money min-w-0 flex-1 truncate text-sm font-semibold">
                        {entry.address}
                      </code>
                      <Pill tone={entry.is_active ? "in" : "neutral"}>
                        {entry.is_active ? "active" : "paused"}
                      </Pill>
                      <button
                        className="btn btn-ghost !px-2.5 !py-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(entry.address);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        }}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>

                    <div className="mt-3">
                      <Field label="Post entries into">
                        <Combo
                          options={accounts.map((a) => ({ id: a.id, label: a.name }))}
                          value={entry.default_account_id}
                          onChange={async (accountId) => {
                            await setInboundAccount(entry.id, accountId, brand.id);
                          }}
                          allowClear={false}
                        />
                      </Field>
                    </div>
                  </div>
                ))}

                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--fg-muted)]">
                  <li>Turn on transaction alert emails in your bank&apos;s net banking.</li>
                  <li>
                    In Gmail, open Settings → Forwarding, add the address above, and paste the
                    verification code Gmail sends (it appears in the imports list below).
                  </li>
                  <li>
                    Create a filter for your bank&apos;s alert sender and choose &ldquo;Forward it
                    to&rdquo; that address.
                  </li>
                </ol>
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <h2 className="mb-3 text-sm font-semibold">Recent imports</h2>
            {!recentImports.length ? (
              <p className="py-5 text-center text-sm text-[var(--fg-muted)]">
                Nothing received yet
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--hairline)]">
                {recentImports.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.subject ?? "(no subject)"}</span>
                      <span className="block text-xs text-[var(--fg-muted)]">
                        {formatDateTime(item.received_at)}
                        {item.error ? ` · ${item.error}` : ""}
                      </span>
                    </span>
                    <Pill
                      tone={
                        item.status === "imported"
                          ? "in"
                          : item.status === "failed"
                            ? "out"
                            : "neutral"
                      }
                    >
                      {item.status}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      <Modal
        open={addOpen !== null}
        onClose={() => setAddOpen(null)}
        title={
          addOpen === "account"
            ? "Add account"
            : addOpen === "category"
              ? "Add category"
              : "Add payment mode"
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Name">
            <input
              className="field"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </Field>

          {addOpen === "account" && (
            <>
              <Field label="Type">
                <div className="glass grid grid-cols-4 gap-1 rounded-full p-1">
                  {(["cash", "bank", "petty", "wallet"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setNewType(option)}
                      className={cn(
                        "rounded-full py-1.5 text-xs font-semibold capitalize transition",
                        newType === option
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--fg-muted)]",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Opening balance">
                <input
                  className="field money"
                  type="number"
                  step="0.01"
                  value={newOpening}
                  onChange={(e) => setNewOpening(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </>
          )}

          <button className="btn btn-accent mt-1" onClick={addRecord} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Add
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ListCard({
  title,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  items: { id: string; label: string; hint?: string }[];
  onAdd: () => void;
  onRemove: (id: string, name: string) => void;
}) {
  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button className="btn btn-ghost !px-3 !py-1.5" onClick={onAdd}>
          <Plus className="size-4" /> Add
        </button>
      </div>

      {!items.length ? (
        <p className="py-5 text-center text-sm text-[var(--fg-muted)]">Nothing here yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--hairline)]">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.label}</span>
                {item.hint && (
                  <span className="block text-xs capitalize text-[var(--fg-muted)]">
                    {item.hint}
                  </span>
                )}
              </span>
              <button
                onClick={() => onRemove(item.id, item.label)}
                className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)]"
                aria-label={`Remove ${item.label}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
