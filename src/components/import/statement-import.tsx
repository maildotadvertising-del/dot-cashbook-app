"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ArrowLeft, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Combo } from "@/components/combo";
import { Field, GlassCard, PageHeader, StatCard } from "@/components/ui";
import { importStatement } from "@/app/actions/statement";
import {
  detectColumns,
  findHeader,
  toStatementRows,
  type Cell,
  type ColumnMap,
} from "@/lib/statement";
import { cn, formatDate, money } from "@/lib/utils";
import type { Account, Brand } from "@/lib/types";

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "narration", label: "Narration" },
  { key: "debit", label: "Debit / Withdrawal" },
  { key: "credit", label: "Credit / Deposit" },
  { key: "amount", label: "Amount (single column)" },
  { key: "drcr", label: "Dr / Cr marker" },
  { key: "ref", label: "Reference no." },
];

export function StatementImport({ brand, accounts }: { brand: Brand; accounts: Account[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(
    accounts.find((a) => a.type === "bank")?.id ?? accounts[0]?.id ?? null,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    try {
      const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null });
      const found = findHeader(rows);

      setFileName(file.name);
      setGrid(rows);
      setHeaderIndex(found?.index ?? 0);
      setMap(found?.map ?? detectColumns(rows[0] ?? []));

      if (!found) toast.warning("Couldn't find the header row — map the columns below");
    } catch {
      toast.error("Couldn't read that file. Download the statement as Excel or CSV.");
    }
  }

  const header = grid[headerIndex] ?? [];
  const rows = useMemo(
    () => (map ? toStatementRows(grid, headerIndex, map) : []),
    [grid, headerIndex, map],
  );
  const totalIn = rows.filter((r) => r.direction === "in").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.direction === "out").reduce((s, r) => s + r.amount, 0);

  async function submit() {
    if (!accountId) return toast.error("Pick the account this statement belongs to");
    if (!rows.length) return toast.error("No transactions found in this file");

    setBusy(true);
    const result = await importStatement({ brand_id: brand.id, account_id: accountId, rows });
    setBusy(false);

    if (result.error) return toast.error(result.error);
    toast.success(
      `${result.imported} imported${result.skipped ? `, ${result.skipped} already in the book` : ""}`,
    );
    router.push(`/b/${brand.id}/review`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/b/${brand.id}/cashbook`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="size-4" /> Cash Book
      </Link>

      <PageHeader
        title="Import bank statement"
        subtitle="Excel or CSV from net banking — re-importing the same file is safe"
      />

      <GlassCard>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Into account">
            <Combo
              options={accounts.map((a) => ({ id: a.id, label: a.name, hint: a.type }))}
              value={accountId}
              onChange={setAccountId}
              allowClear={false}
            />
          </Field>

          <Field label="Statement file" hint="PDF statements aren't supported — download Excel/CSV">
            <label className="field flex cursor-pointer items-center gap-2">
              <Upload className="size-4 text-[var(--fg-muted)]" />
              <span className={cn("truncate", !fileName && "text-[var(--fg-subtle)]")}>
                {fileName ?? "Choose .xlsx, .xls or .csv"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              />
            </label>
          </Field>
        </div>
      </GlassCard>

      {map && (
        <>
          <GlassCard className="mt-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Columns</h2>
              <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                Header row
                <input
                  className="field money !w-20 !py-1.5"
                  type="number"
                  min={1}
                  max={grid.length}
                  value={headerIndex + 1}
                  onChange={(e) => {
                    const index = Math.max(0, Number(e.target.value) - 1);
                    setHeaderIndex(index);
                    setMap(detectColumns(grid[index] ?? []));
                  }}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  <select
                    className="field"
                    value={map[field.key] ?? ""}
                    onChange={(e) =>
                      setMap({
                        ...map,
                        [field.key]: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  >
                    <option value="">—</option>
                    {header.map((cell, index) => (
                      <option key={index} value={index}>
                        {String(cell ?? `Column ${index + 1}`)}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </GlassCard>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <StatCard label="Transactions" value={String(rows.length)} />
            <StatCard label="Money in" value={totalIn} tone="in" />
            <StatCard label="Money out" value={totalOut} tone="out" />
          </div>

          <GlassCard className="mt-3 !p-0">
            {!rows.length ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
                <FileSpreadsheet className="size-8" />
                No transactions recognised yet — check the date and amount columns above.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 bg-[var(--glass-bg-strong)] backdrop-blur">
                    <tr className="border-b border-[var(--hairline)] text-left text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Payee</th>
                      <th className="px-4 py-2.5 font-semibold">Note</th>
                      <th className="px-4 py-2.5 text-right font-semibold">In</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((row, index) => (
                      <tr key={index} className="border-b border-[var(--hairline)] last:border-0">
                        <td className="whitespace-nowrap px-4 py-2 text-[var(--fg-muted)]">
                          {formatDate(row.date)}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2">{row.counterparty ?? "—"}</td>
                        <td className="max-w-[240px] truncate px-4 py-2 text-[var(--fg-muted)]">
                          {row.note ?? ""}
                        </td>
                        <td className="money px-4 py-2 text-right text-[var(--in)]">
                          {row.direction === "in" ? `₹${money(row.amount)}` : ""}
                        </td>
                        <td className="money px-4 py-2 text-right text-[var(--out)]">
                          {row.direction === "out" ? `₹${money(row.amount)}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <p className="px-4 py-2.5 text-xs text-[var(--fg-muted)]">
                    Showing 200 of {rows.length} — all will be imported
                  </p>
                )}
              </div>
            )}
          </GlassCard>

          <div className="mt-3 flex justify-end">
            <button className="btn btn-accent" onClick={submit} disabled={busy || !rows.length}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Import {rows.length} transactions
            </button>
          </div>
        </>
      )}
    </div>
  );
}
