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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight lg:text-[26px]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--fg-muted)]">{subtitle}</p>}
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

  return (
    <div className="glass card rise !p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[var(--fg-muted)]">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className={cn("money text-[22px] font-bold lg:text-[26px]", toneClass)}>
        {typeof value === "number" ? `₹${money(value)}` : value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-[var(--fg-muted)]">{hint}</div>}
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
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-[var(--fg-subtle)]">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-[var(--fg-muted)]">{description}</p>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[3px] sm:items-center sm:p-5">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "glass-strong rise relative max-h-[92dvh] w-full overflow-auto rounded-t-[26px] p-5 sm:rounded-[26px]",
          wide ? "sm:max-w-3xl" : "sm:max-w-md",
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--accent-soft)]"
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
      <span className="text-xs font-semibold text-[var(--fg-muted)]">{label}</span>
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
  tone?: "neutral" | "in" | "out" | "accent" | "warn";
}) {
  const tones = {
    neutral: "bg-[var(--hairline)] text-[var(--fg-muted)]",
    in: "bg-[var(--in-soft)] text-[var(--in)]",
    out: "bg-[var(--out-soft)] text-[var(--out)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    warn: "bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-[var(--warn)]",
  };
  return <span className={cn("pill", tones[tone])}>{children}</span>;
}
