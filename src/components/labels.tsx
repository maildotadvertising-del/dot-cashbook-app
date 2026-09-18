"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Tag, X } from "lucide-react";
import { saveLabel } from "@/app/actions/labels";
import { cn } from "@/lib/utils";
import { LABEL_COLORS, type Label } from "@/lib/types";

/** Label colour as the theme's tint trio: soft fill, hairline, solid text. */
export function labelStyle(color: string) {
  return {
    background: `${color}26`,
    borderColor: `${color}47`,
    color,
  };
}

export function LabelChips({ labels, ids }: { labels: Label[]; ids: string[] }) {
  const shown = ids.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
  if (!shown.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((label) => (
        <span key={label.id} className="pill" style={labelStyle(label.color)}>
          {label.name}
        </span>
      ))}
    </span>
  );
}

/**
 * Toggle chips for picking labels, plus inline creation so a new tag can be
 * made without leaving the entry being written.
 */
export function LabelPicker({
  brandId,
  labels,
  value,
  onChange,
}: {
  brandId: string;
  labels: Label[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // Newly created labels show immediately, before the refreshed list arrives.
  const [created, setCreated] = useState<Label[]>([]);
  const all = [...labels, ...created.filter((c) => !labels.some((l) => l.id === c.id))];

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const color = LABEL_COLORS[all.length % LABEL_COLORS.length];
    const result = await saveLabel({ brand_id: brandId, name, color });
    setBusy(false);
    if (result.error) return toast.error(result.error);
    setCreated((c) => [...c, { id: result.id!, brand_id: brandId, name: name.trim(), color }]);
    onChange([...value, result.id!]);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((label) => {
        const on = value.includes(label.id);
        return (
          <button
            key={label.id}
            type="button"
            onClick={() => toggle(label.id)}
            className={cn("pill !px-3 !py-1.5 !text-xs transition-opacity", !on && "opacity-45 hover:opacity-80")}
            style={labelStyle(label.color)}
          >
            {on && <X className="size-3" />}
            {label.name}
          </button>
        );
      })}

      {adding ? (
        <span className="flex items-center gap-1">
          <input
            className="field !w-36 !py-1.5 !text-xs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="New label"
            autoFocus
            disabled={busy}
          />
          <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={create} disabled={busy}>
            Add
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pill !px-3 !py-1.5 !text-xs border-dashed border-[var(--glass-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          {all.length ? <Plus className="size-3" /> : <Tag className="size-3" />}
          {all.length ? "Label" : "Add label"}
        </button>
      )}
    </div>
  );
}
