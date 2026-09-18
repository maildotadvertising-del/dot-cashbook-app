"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, Plus, SkipForward, Trash2 } from "lucide-react";
import { deleteRecurring, postRecurring, saveRecurring, type RecurringInput } from "@/app/actions/labels";
import { Combo } from "@/components/combo";
import { LabelChips, LabelPicker } from "@/components/labels";
import { EmptyState, Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import { cn, formatDate, money, todayISO } from "@/lib/utils";
import type {
  Account,
  Category,
  Frequency,
  Label,
  Party,
  PaymentMode,
  RecurringEntry,
} from "@/lib/types";

type Draft = Omit<RecurringInput, "brand_id" | "amount"> & { amount: string };

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function dueTone(date: string) {
  const today = todayISO();
  if (date < today) return { tone: "out" as const, text: "overdue" };
  if (date === today) return { tone: "warn" as const, text: "due today" };
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (days <= 7) return { tone: "warn" as const, text: `in ${days} day${days === 1 ? "" : "s"}` };
  return { tone: "neutral" as const, text: formatDate(date) };
}

export function RecurringView({
  brandId,
  entries,
  accounts,
  categories,
  parties,
  paymentModes,
  labels,
  canWrite,
}: {
  brandId: string;
  entries: RecurringEntry[];
  accounts: Account[];
  categories: Category[];
  parties: Party[];
  paymentModes: PaymentMode[];
  labels: Label[];
  canWrite: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const due = entries.filter((e) => e.is_active && e.next_due <= todayISO());
  const monthlyOut = entries
    .filter((e) => e.is_active && e.direction === "out")
    .reduce((sum, e) => sum + Number(e.amount) * { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[e.frequency], 0);

  const blank = (): Draft => ({
    name: "",
    direction: "out",
    amount: "",
    account_id: accounts[0]?.id ?? "",
    category_id: null,
    party_id: null,
    payment_mode_id: null,
    label_ids: [],
    remark: "",
    frequency: "monthly",
    next_due: todayISO(),
    is_active: true,
  });

  async function save() {
    if (!draft) return;
    setBusy(true);
    const result = await saveRecurring({ ...draft, amount: Number(draft.amount), brand_id: brandId });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Recurring entry saved");
    setDraft(null);
  }

  async function post(entry: RecurringEntry, skip = false) {
    setPosting(entry.id);
    const result = await postRecurring(entry.id, { skip });
    setPosting(null);
    if (result.error) return toast.error(result.error);
    toast.success(skip ? `Skipped — next due moved on` : `₹${money(entry.amount)} added to the cash book`);
  }

  async function remove(entry: RecurringEntry) {
    if (!window.confirm(`Delete recurring “${entry.name}”? Past cash book entries stay.`)) return;
    const result = await deleteRecurring(entry.id, brandId);
    if (result.error) return toast.error(result.error);
    toast.success("Deleted");
    setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title="Recurring"
        subtitle={`Rent, salaries, retainers · ~₹${money(monthlyOut)} going out per month`}
        actions={
          canWrite && (
            <button className="btn btn-accent" onClick={() => setDraft(blank())}>
              <Plus className="size-4" /> Add recurring
            </button>
          )
        }
      />

      {due.length > 0 && (
        <p className="mb-3 text-[13px] text-[var(--warn)]">
          {due.length} due now — post to add them to the cash book, or skip to move to the next date.
        </p>
      )}

      {!entries.length ? (
        <GlassCard>
          <EmptyState
            icon={<CalendarClock className="size-9" />}
            title="Nothing recurring yet"
            description="Add Office Rent, Team Salary, monthly social media retainers — they'll remind you when due and post in one tap."
            action={
              canWrite ? (
                <button className="btn btn-accent" onClick={() => setDraft(blank())}>
                  <Plus className="size-4" /> Add recurring
                </button>
              ) : undefined
            }
          />
        </GlassCard>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {[...entries]
            .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.next_due.localeCompare(b.next_due))
            .map((entry) => {
              const status = dueTone(entry.next_due);
              const isDue = entry.is_active && entry.next_due <= todayISO();
              return (
                <GlassCard
                  key={entry.id}
                  className={cn(!entry.is_active && "opacity-50", isDue && entry.direction === "out" && "tint-out", isDue && entry.direction === "in" && "tint-in")}
                >
                  <button
                    className="w-full text-left"
                    disabled={!canWrite}
                    onClick={() =>
                      setDraft({
                        id: entry.id,
                        name: entry.name,
                        direction: entry.direction,
                        amount: String(entry.amount),
                        account_id: entry.account_id,
                        category_id: entry.category_id,
                        party_id: entry.party_id,
                        payment_mode_id: entry.payment_mode_id,
                        label_ids: entry.label_ids,
                        remark: entry.remark ?? "",
                        frequency: entry.frequency,
                        next_due: entry.next_due,
                        is_active: entry.is_active,
                      })
                    }
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{entry.name}</span>
                        <span className="block text-[11px] capitalize text-[var(--fg-muted)]">
                          {entry.frequency} · {accounts.find((a) => a.id === entry.account_id)?.name}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "money shrink-0 text-sm",
                          entry.direction === "in" ? "text-[var(--in)]" : "text-[var(--out)]",
                        )}
                      >
                        {entry.direction === "in" ? "+" : "−"}₹{money(entry.amount)}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Pill tone={entry.is_active ? status.tone : "neutral"}>
                        {entry.is_active ? status.text : "paused"}
                      </Pill>
                      <LabelChips labels={labels} ids={entry.label_ids} />
                    </span>
                  </button>

                  {isDue && canWrite && (
                    <div className="mt-3 flex gap-2 border-t-[0.5px] border-[var(--hairline)] pt-3">
                      <button
                        className={cn("btn flex-1", entry.direction === "in" ? "btn-in" : "btn-out")}
                        onClick={() => post(entry)}
                        disabled={posting === entry.id}
                      >
                        {posting === entry.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Post {formatDate(entry.next_due)}
                      </button>
                      <button className="btn btn-ghost" onClick={() => post(entry, true)} disabled={posting === entry.id}>
                        <SkipForward className="size-4" /> Skip
                      </button>
                    </div>
                  )}
                </GlassCard>
              );
            })}
        </div>
      )}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit recurring" : "New recurring"}>
        {draft && (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-1.5">
              {(["out", "in"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDraft({ ...draft, direction: d })}
                  className={cn(
                    "rounded-[12px] border-[0.5px] py-2.5 text-sm transition-colors",
                    draft.direction === d
                      ? d === "in"
                        ? "border-[rgba(48,209,88,0.35)] bg-[var(--in-soft)] font-semibold text-[var(--in)]"
                        : "border-[rgba(255,69,58,0.35)] bg-[var(--out-soft)] font-semibold text-[var(--out)]"
                      : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                  )}
                >
                  {d === "in" ? "Money in" : "Money out"}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className="field"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Office Rent"
                  autoFocus
                />
              </Field>
              <Field label="Amount">
                <input
                  className="field money"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  placeholder="0.00"
                />
              </Field>
            </div>

            <Field label="Repeats">
              <div className="flex gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, frequency: f.value })}
                    className={cn(
                      "flex-1 rounded-full border-[0.5px] py-2 text-xs transition-colors",
                      draft.frequency === f.value
                        ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                        : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Next due">
                <input
                  className="field"
                  type="date"
                  value={draft.next_due}
                  onChange={(e) => setDraft({ ...draft, next_due: e.target.value })}
                />
              </Field>
              <Field label="Account">
                <Combo
                  options={accounts.map((a) => ({ id: a.id, label: a.name }))}
                  value={draft.account_id}
                  onChange={(v) => setDraft({ ...draft, account_id: v ?? draft.account_id })}
                  allowClear={false}
                />
              </Field>
              <Field label="Category">
                <Combo
                  options={categories.map((c) => ({ id: c.id, label: c.name }))}
                  value={draft.category_id}
                  onChange={(v) => setDraft({ ...draft, category_id: v })}
                  placeholder="Category"
                />
              </Field>
              <Field label="Party">
                <Combo
                  options={parties.map((p) => ({ id: p.id, label: p.name }))}
                  value={draft.party_id}
                  onChange={(v) => setDraft({ ...draft, party_id: v })}
                  placeholder="Landlord, staff, client…"
                />
              </Field>
              <Field label="Payment mode">
                <Combo
                  options={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
                  value={draft.payment_mode_id}
                  onChange={(v) => setDraft({ ...draft, payment_mode_id: v })}
                  placeholder="Mode"
                />
              </Field>
              <Field label="Remark">
                <input
                  className="field"
                  value={draft.remark ?? ""}
                  onChange={(e) => setDraft({ ...draft, remark: e.target.value })}
                  placeholder="Shown on the cash book entry"
                />
              </Field>
            </div>

            <Field label="Labels">
              <LabelPicker
                brandId={brandId}
                labels={labels}
                value={draft.label_ids}
                onChange={(ids) => setDraft({ ...draft, label_ids: ids })}
              />
            </Field>

            <label className="flex items-center justify-between text-sm">
              Active
              <button
                type="button"
                role="switch"
                aria-checked={draft.is_active}
                onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}
                className={cn("relative h-6 w-[42px] rounded-full transition-colors", draft.is_active ? "bg-[var(--green)]" : "bg-white/10")}
              >
                <span className={cn("absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all", draft.is_active ? "left-[21px]" : "left-[3px]")} />
              </button>
            </label>

            <div className="mt-1 flex gap-2">
              {draft.id && (
                <button
                  className="btn btn-ghost !px-3 text-[var(--out)]"
                  onClick={() => {
                    const entry = entries.find((e) => e.id === draft.id);
                    if (entry) remove(entry);
                  }}
                  aria-label="Delete recurring"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button className="btn btn-accent flex-1 !py-3" onClick={save} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
