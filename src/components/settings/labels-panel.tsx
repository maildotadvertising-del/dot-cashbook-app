"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { deleteLabel, saveLabel } from "@/app/actions/labels";
import { EmptyState, Field, GlassCard, Modal } from "@/components/ui";
import { labelStyle } from "@/components/labels";
import { cn } from "@/lib/utils";
import { LABEL_COLORS, type Label } from "@/lib/types";

export function LabelsPanel({ brandId, labels }: { brandId: string; labels: Label[] }) {
  const [editing, setEditing] = useState<Partial<Label> | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing?.name?.trim()) return toast.error("Enter a name");
    setBusy(true);
    const result = await saveLabel({
      id: editing.id,
      brand_id: brandId,
      name: editing.name,
      color: editing.color ?? LABEL_COLORS[0],
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success("Label saved");
    setEditing(null);
  }

  async function remove(label: Label) {
    if (!window.confirm(`Delete label “${label.name}”? It will be removed from every entry that has it.`)) return;
    const result = await deleteLabel(label.id, brandId);
    if (result.error) return toast.error(result.error);
    toast.success("Label deleted");
  }

  return (
    <GlassCard>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-medium">Labels</h2>
        <button
          className="btn btn-ghost !px-3 !py-1.5"
          onClick={() => setEditing({ color: LABEL_COLORS[labels.length % LABEL_COLORS.length] })}
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
      <p className="mb-3 text-xs text-[var(--fg-muted)]">
        Tags that sit alongside the category — e.g. Office Expenses vs Family Expenses — for filtering and reports.
      </p>

      {!labels.length ? (
        <EmptyState icon={<Tag className="size-7" />} title="No labels yet" />
      ) : (
        <div className="flex flex-col divide-y-[0.5px] divide-[var(--hairline)]">
          {labels.map((label) => (
            <div key={label.id} className="flex items-center gap-3 py-2.5">
              <span className="pill !text-xs" style={labelStyle(label.color)}>
                {label.name}
              </span>
              <span className="flex-1" />
              <button
                onClick={() => setEditing(label)}
                className="grid size-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-white/5 hover:text-[var(--accent)]"
                aria-label={`Edit ${label.name}`}
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => remove(label)}
                className="grid size-8 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)]"
                aria-label={`Delete ${label.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit label" : "New label"}>
        {editing && (
          <div className="flex flex-col gap-3.5">
            <Field label="Name">
              <input
                className="field"
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Office Expenses"
                autoFocus
              />
            </Field>
            <Field label="Colour">
              <div className="flex gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditing({ ...editing, color })}
                    className={cn(
                      "size-8 rounded-full border-[0.5px] transition-transform",
                      editing.color === color ? "scale-110 ring-2 ring-white/40" : "opacity-70",
                    )}
                    style={{ background: `${color}40`, borderColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </Field>
            {editing.name && (
              <span className="pill self-start !text-xs" style={labelStyle(editing.color ?? LABEL_COLORS[0])}>
                {editing.name}
              </span>
            )}
            <button className="btn btn-accent mt-1 !py-3" onClick={save} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save label
            </button>
          </div>
        )}
      </Modal>
    </GlassCard>
  );
}
