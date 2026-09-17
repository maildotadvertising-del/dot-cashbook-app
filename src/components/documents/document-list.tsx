"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileText, Plus, Search } from "lucide-react";
import { EmptyState, GlassCard, PageHeader, Pill } from "@/components/ui";
import { exportRows } from "@/lib/export";
import { DOC_META } from "@/lib/doc-meta";
import { cn, formatDate, money } from "@/lib/utils";
import type { Brand, DocStatus, DocType } from "@/lib/types";

export interface DocumentListRow {
  id: string;
  doc_number: string;
  doc_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  status: DocStatus;
  is_gst: boolean;
  party: { name: string } | null;
}

const STATUS_TONE: Record<DocStatus, "neutral" | "in" | "out" | "accent" | "warn"> = {
  draft: "neutral",
  sent: "accent",
  accepted: "in",
  rejected: "out",
  partial: "warn",
  paid: "in",
  cancelled: "neutral",
};

export function DocumentList({
  brand,
  docType,
  documents,
}: {
  brand: Brand;
  docType: DocType;
  documents: DocumentListRow[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | DocStatus>("all");

  const { base, label } = DOC_META[docType];
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((d) => {
      const matchesStatus = status === "all" || d.status === status;
      const matchesTerm =
        !term ||
        d.doc_number.toLowerCase().includes(term) ||
        d.party?.name.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [documents, search, status]);

  const outstanding = documents
    .filter((d) => !["paid", "cancelled", "draft", "rejected"].includes(d.status))
    .reduce((sum, d) => sum + (Number(d.total) - Number(d.amount_paid)), 0);

  const statuses: ("all" | DocStatus)[] =
    docType === "quotation"
      ? ["all", "draft", "sent", "accepted", "rejected"]
      : ["all", "draft", "sent", "partial", "paid"];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${label}s`}
        subtitle={
          docType === "quotation"
            ? `${documents.length} quotations`
            : `₹${money(outstanding)} ${docType === "purchase_bill" ? "to pay" : "outstanding"} across ${documents.length} ${label.toLowerCase()}s`
        }
        actions={
          <>
            <button
              className="btn btn-ghost"
              onClick={() =>
                exportRows(
                  `${brand.name} ${base}`,
                  documents.map((d) => ({
                    Number: d.doc_number,
                    Date: d.doc_date,
                    Party: d.party?.name ?? "",
                    Total: Number(d.total),
                    Paid: Number(d.amount_paid),
                    Status: d.status,
                  })),
                )
              }
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <Link href={`/b/${brand.id}/${base}/new`} className="btn btn-accent">
              <Plus className="size-4" /> New {label.toLowerCase()}
            </Link>
          </>
        }
      />

      <GlassCard className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              className="field !pl-9"
              placeholder={`Search ${base} or party…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="glass flex flex-wrap gap-1 rounded-full p-1">
            {statuses.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition",
                  status === option ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="mt-4">
        {!filtered.length ? (
          <GlassCard>
            <EmptyState
              icon={<FileText className="size-9" />}
              title={documents.length ? "No match" : `No ${base} yet`}
              description={`Create a ${label.toLowerCase()}, with or without GST, and share it as a PDF.`}
              action={
                !documents.length ? (
                  <Link href={`/b/${brand.id}/${base}/new`} className="btn btn-accent">
                    <Plus className="size-4" /> New {label.toLowerCase()}
                  </Link>
                ) : undefined
              }
            />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((d) => {
              const due = Number(d.total) - Number(d.amount_paid);
              const overdue =
                docType === "invoice" &&
                d.due_date &&
                d.due_date < today &&
                due > 0 &&
                d.status !== "cancelled";

              return (
                <Link
                  key={d.id}
                  href={`/b/${brand.id}/${base}/${d.id}`}
                  className="glass glass-hover card rise flex items-center gap-3 !p-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.doc_number}</span>
                      <Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill>
                      {!d.is_gst && <Pill tone="neutral">no GST</Pill>}
                      {overdue && <Pill tone="out">overdue</Pill>}
                    </span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {d.party?.name ?? "No party"} · {formatDate(d.doc_date)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="money block text-sm font-bold">₹{money(d.total)}</span>
                    {due > 0 && d.status !== "draft" && (
                      <span className="block text-[11px] text-[var(--fg-muted)]">
                        ₹{money(due)} due
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
