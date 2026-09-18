"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn, money } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rise mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13.5px] text-[var(--fg-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function GlassCard({
  className,
  children,
  strong,
}: {
  className?: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={cn(strong ? "glass-strong" : "glass", "card rise", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "neutral",
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "in" | "out" | "accent";
  hint?: string;
  icon?: React.ReactNode;
}) {
  const toneClass = {
    neutral: "text-[var(--fg)]",
    in: "text-[var(--in)]",
    out: "text-[var(--out)]",
    accent: "text-[var(--accent)]",
  }[tone];

  const tint = {
    neutral: "",
    in: "tint-in",
    out: "tint-out",
    accent: "tint-accent",
  }[tone];

  return (
    <div className={cn("glass card rise", tint)}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[var(--fg-muted)]">
        {icon}
        <span className="label-caps">{label}</span>
      </div>
      <div className={cn("money text-[24px] font-semibold tracking-[-0.03em]", toneClass)}>
        {typeof value === "number" ? `₹${money(value)}` : value}
      </div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-[var(--fg-subtle)]">{icon}</div>}
      <p className="text-[15px] font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] text-[var(--fg-muted)]">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-5">
      <div className="backdrop absolute inset-0 bg-black/55 backdrop-blur-[8px]" onClick={onClose} />
      <div
        className={cn(
          "glass-strong sheet relative max-h-[88dvh] w-full overflow-auto rounded-t-[28px] p-5 sm:rounded-[28px]",
          wide ? "sm:max-w-3xl" : "sm:max-w-[520px]",
        )}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto -mt-2 mb-3 h-1 w-9 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-semibold tracking-[-0.025em]">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full bg-white/5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="label-caps">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[var(--fg-subtle)]">{hint}</span>}
    </label>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "in" | "out" | "accent" | "warn" | "special";
}) {
  const tones = {
    neutral: "bg-white/5 text-[var(--fg-muted)] border-[var(--glass-border)]",
    in: "bg-[var(--in-soft)] text-[var(--in)] border-[var(--in-line)]",
    out: "bg-[var(--out-soft)] text-[var(--out)] border-[var(--out-line)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-line)]",
    warn: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn-line)]",
    special: "bg-[var(--special-soft)] text-[var(--special)] border-[rgba(191,95,255,0.28)]",
  };
  return <span className={cn("pill", tones[tone])}>{children}</span>;
}
