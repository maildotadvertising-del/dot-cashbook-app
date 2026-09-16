"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Select-with-search. When `onCreate` is given, typing a name that does not
 * exist offers to create it inline — the fast path for adding a party or
 * category mid-entry instead of leaving the form.
 */
export function Combo({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  allowClear = true,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  onCreate?: (name: string) => Promise<string | null>;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options.slice(0, 80);
    return options.filter((o) => o.label.toLowerCase().includes(term)).slice(0, 80);
  }, [options, search]);

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === search.trim().toLowerCase(),
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function create() {
    if (!onCreate) return;
    setCreating(true);
    const id = await onCreate(search.trim());
    setCreating(false);
    if (id) {
      onChange(id);
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        className="field flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn("truncate", !selected && "text-[var(--fg-subtle)]")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-[var(--fg-muted)]" />
      </button>

      {open && (
        <div className="glass-strong absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[16px]">
          <div className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2">
            <Search className="size-4 shrink-0 text-[var(--fg-muted)]" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-auto p-1.5">
            {allowClear && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-left text-sm text-[var(--fg-muted)] hover:bg-[var(--accent-soft)]"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                None
              </button>
            )}

            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--accent-soft)]"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="min-w-0 flex-1 truncate">
                  {option.label}
                  {option.hint && (
                    <span className="ml-1.5 text-xs text-[var(--fg-subtle)]">{option.hint}</span>
                  )}
                </span>
                {option.id === value && <Check className="size-4 text-[var(--accent)]" />}
              </button>
            ))}

            {onCreate && search.trim() && !exactMatch && (
              <button
                type="button"
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-left text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                onClick={create}
              >
                <Plus className="size-4" />
                Create “{search.trim()}”
              </button>
            )}

            {!filtered.length && !search.trim() && (
              <p className="px-2.5 py-3 text-center text-sm text-[var(--fg-subtle)]">
                Nothing here yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
