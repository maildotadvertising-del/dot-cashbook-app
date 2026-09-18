"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { deleteRule, saveRule, type RuleInput } from "@/app/actions/labels";
import { Combo } from "@/components/combo";
import { LabelChips, LabelPicker } from "@/components/labels";
import { EmptyState, Field, GlassCard, Modal, Pill } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Category, CategoryRule, Label, Party, PaymentMode } from "@/lib/types";

type Draft = Omit<RuleInput, "brand_id">;

const blank = (): Draft => ({
  name: "",
  keywords: [],
  direction: null,
  category_id: null,
  party_id: null,
  payment_mode_id: null,
  label_ids: [],
  is_active: true,
});

export function RulesPanel({
  brandId,
  rules,
  categories,
  parties,
  paymentModes,
  labels,
}: {
  brandId: string;
  rules: CategoryRule[];
  categories: Category[];
  parties: Party[];
  paymentModes: PaymentMode[];
  labels: Label[];
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = (list: { id: string; name: string }[], id: string | null) =>
    list.find((x) => x.id === id)?.name ?? null;

  function addKeywords(raw: string) {
    if (!draft) return;
    const parts = raw.split(",").map((k) => k.trim()).filter(Boolean);
    if (!parts.length) return;
    setDraft({ ...draft, keywords: [...new Set([...draft.keywords, ...parts])] });
    setKeywordInput("");
  }

  async function save() {
    if (!draft) return;
    const pending = keywordInput.split(",").map((k) => k.trim()).filter(Boolean);
    setBusy(true);
    const result = await saveRule({
      ...draft,
      keywords: [...draft.keywords, ...pending],
      brand_id: brandId,
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Rule saved");
    setDraft(null);
    setKeywordInput("");
  }

  async function remove(rule: CategoryRule) {
    if (!window.confirm(`Delete rule “${rule.name}”?`)) return;
    const result = await deleteRule(rule.id, brandId);
    if (result.error) return toast.error(result.error);
    toast.success("Rule deleted");
  }

  return (
    <GlassCard>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-medium">Auto rules</h2>
        <button className="btn btn-ghost !px-3 !py-1.5" onClick={() => setDraft(blank())}>
          <Plus className="size-4" /> Add rule
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--fg-muted)]">
        When a remark or bank narration contains a keyword, the rule fills in category, party, payment mode and
        labels — on UPI imports, statement imports, and while you type a new entry. Rules higher in the list win.
      </p>

      {!rules.length ? (
        <EmptyState
          icon={<Sparkles className="size-7" />}
          title="No rules yet"
          description="e.g. keywords Tea, Juice, Snacks → category Tea & Snacks"
        />
      ) : (
        <div className="flex flex-col divide-y-[0.5px] divide-[var(--hairline)]">
          {rules.map((rule) => {
            const targets = [
              nameOf(categories, rule.category_id),
              nameOf(parties, rule.party_id),
              nameOf(paymentModes, rule.payment_mode_id),
            ].filter(Boolean);
            return (
              <div key={rule.id} className={cn("flex items-start gap-3 py-3", !rule.is_active && "opacity-50")}>
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setDraft({
                      id: rule.id,
                      name: rule.name,
                      keywords: rule.keywords,
                      direction: rule.direction,
                      category_id: rule.category_id,
                      party_id: rule.party_id,
                      payment_mode_id: rule.payment_mode_id,
                      label_ids: rule.label_ids,
                      is_active: rule.is_active,
                    });
                    setKeywordInput("");
                  }}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{rule.name}</span>
                    {rule.direction && <Pill tone={rule.direction === "in" ? "in" : "out"}>{rule.direction === "in" ? "money in" : "money out"}</Pill>}
                    {!rule.is_active && <Pill>paused</Pill>}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {rule.keywords.map((k) => (
                      <span key={k} className="money rounded-[6px] bg-white/5 px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                        {k}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                    → {targets.join(" · ") || "labels only"}
                    <LabelChips labels={labels} ids={rule.label_ids} />
                  </span>
                </button>
                <button
                  onClick={() => remove(rule)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)]"
                  aria-label={`Delete ${rule.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit rule" : "New auto rule"}>
        {draft && (
          <div className="flex flex-col gap-3.5">
            <Field label="Keywords" hint="Comma or Enter to add. Whole-word, not case-sensitive.">
              <div className="field flex flex-wrap items-center gap-1.5 !py-2">
                {draft.keywords.map((k) => (
                  <span key={k} className="pill !text-xs border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    {k}
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, keywords: draft.keywords.filter((x) => x !== k) })}
                      aria-label={`Remove ${k}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="min-w-24 flex-1 bg-transparent text-sm outline-none"
                  value={keywordInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.includes(",")) addKeywords(v);
                    else setKeywordInput(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeywords(keywordInput);
                    }
                    if (e.key === "Backspace" && !keywordInput && draft.keywords.length) {
                      setDraft({ ...draft, keywords: draft.keywords.slice(0, -1) });
                    }
                  }}
                  placeholder={draft.keywords.length ? "" : "Tea, Juice, Snacks"}
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Rule name">
              <input
                className="field"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={draft.keywords[0] ?? "Tea & Snacks"}
              />
            </Field>

            <Field label="Applies to">
              <div className="flex gap-1.5">
                {([null, "out", "in"] as const).map((d) => (
                  <button
                    key={String(d)}
                    type="button"
                    onClick={() => setDraft({ ...draft, direction: d })}
                    className={cn(
                      "flex-1 rounded-full border-[0.5px] py-2 text-xs transition-colors",
                      draft.direction === d
                        ? "border-[var(--accent-line)] bg-[rgba(10,132,255,0.18)] font-medium text-[var(--accent)]"
                        : "border-[var(--glass-border)] bg-white/5 text-[var(--fg-muted)]",
                    )}
                  >
                    {d === null ? "In & Out" : d === "out" ? "Cash Out" : "Cash In"}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Set category">
                <Combo
                  options={categories.map((c) => ({ id: c.id, label: c.name }))}
                  value={draft.category_id}
                  onChange={(v) => setDraft({ ...draft, category_id: v })}
                  placeholder="Don't change"
                />
              </Field>
              <Field label="Set party">
                <Combo
                  options={parties.map((p) => ({ id: p.id, label: p.name }))}
                  value={draft.party_id}
                  onChange={(v) => setDraft({ ...draft, party_id: v })}
                  placeholder="Don't change"
                />
              </Field>
              <Field label="Set payment mode">
                <Combo
                  options={paymentModes.map((m) => ({ id: m.id, label: m.name }))}
                  value={draft.payment_mode_id}
                  onChange={(v) => setDraft({ ...draft, payment_mode_id: v })}
                  placeholder="Don't change"
                />
              </Field>
            </div>

            <Field label="Add labels">
              <LabelPicker
                brandId={brandId}
                labels={labels}
                value={draft.label_ids}
                onChange={(ids) => setDraft({ ...draft, label_ids: ids })}
              />
            </Field>

            <label className="flex items-center justify-between text-sm">
              Rule is active
              <button
                type="button"
                role="switch"
                aria-checked={draft.is_active}
                onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}
                className={cn(
                  "relative h-6 w-[42px] rounded-full transition-colors",
                  draft.is_active ? "bg-[var(--green)]" : "bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all",
                    draft.is_active ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </button>
            </label>

            <button className="btn btn-accent mt-1 !py-3" onClick={save} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save rule
            </button>
          </div>
        )}
      </Modal>
    </GlassCard>
  );
}
