import type { Direction } from "@/lib/types";

export type Cell = string | number | Date | null | undefined;

export interface ColumnMap {
  date: number | null;
  narration: number | null;
  debit: number | null;
  credit: number | null;
  /** Single signed/marked amount column, for statements without debit/credit split. */
  amount: number | null;
  /** "Dr"/"Cr" marker column that goes with `amount`. */
  drcr: number | null;
  ref: number | null;
}

export interface StatementRow {
  date: string;
  direction: Direction;
  amount: number;
  narration: string;
  ref: string | null;
  counterparty: string | null;
  note: string | null;
}

const HEADER_HINTS: Record<keyof ColumnMap, RegExp> = {
  date: /^(txn|tran|transaction|value)?\s*date$|^date$/i,
  narration: /narration|description|particulars|details|remarks?/i,
  debit: /withdrawal|debit|dr\.?\s*amount|^dr$|paid out/i,
  credit: /deposit|credit|cr\.?\s*amount|^cr$|paid in/i,
  amount: /^(txn|transaction)?\s*amount$/i,
  drcr: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type)$/i,
  ref: /ref|chq|cheque|utr/i,
};

const clean = (cell: Cell) => (cell instanceof Date ? "" : String(cell ?? "").trim());

/**
 * Bank exports put a few lines of account details above the real header, so
 * the header is the first row that names both a date and an amount column.
 */
export function findHeader(rows: Cell[][]): { index: number; map: ColumnMap } | null {
  for (let index = 0; index < Math.min(rows.length, 40); index++) {
    const map = detectColumns(rows[index]);
    const hasMoney = map.debit !== null || map.credit !== null || map.amount !== null;
    if (map.date !== null && hasMoney) return { index, map };
  }
  return null;
}

export function detectColumns(header: Cell[]): ColumnMap {
  const map: ColumnMap = {
    date: null, narration: null, debit: null, credit: null, amount: null, drcr: null, ref: null,
  };
  const labels = header.map(clean);

  // Order matters: "Value Date" should not steal "date" from "Txn Date", and
  // "Cr Amount" must be claimed as credit before the generic amount check.
  for (const key of ["debit", "credit", "drcr", "amount", "date", "narration", "ref"] as const) {
    const index = labels.findIndex(
      (label, i) => label && HEADER_HINTS[key].test(label) && !Object.values(map).includes(i),
    );
    if (index !== -1) map[key] = index;
  }
  return map;
}

export function parseAmount(cell: Cell): number {
  if (typeof cell === "number") return cell;
  const text = clean(cell).replace(/[,₹\s]|INR|Rs\.?/gi, "");
  if (!text || text === "-") return 0;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const value = Number(text.replace(/[()\-]/g, "").replace(/(cr|dr)$/i, ""));
  return Number.isNaN(value) ? 0 : negative ? -value : value;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(cell: Cell): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const offset = cell.getTimezoneOffset();
    return new Date(cell.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }
  if (typeof cell === "number" && cell > 20000 && cell < 80000) {
    // Excel serial date
    return new Date(Date.UTC(1899, 11, 30) + cell * 86_400_000).toISOString().slice(0, 10);
  }

  const text = clean(cell);
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return iso(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  m = text.match(/^(\d{1,2})[-\s/]?([A-Za-z]{3})[a-z]*[-\s/,]*(\d{2,4})/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month >= 0) return iso(Number(m[3]), month, Number(m[1]));
  }
  return null;
}

function iso(year: number, month: number, day: number) {
  const full = year < 100 ? 2000 + year : year;
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(full, month, day)).toISOString().slice(0, 10);
}

/**
 * UPI narrations are slash-separated, e.g.
 * "UPI/526312345678/RAMESH K/ramesh@okhdfc/Promo work" — the payee name,
 * VPA, and the note the payer typed are all in there.
 */
export function parseNarration(narration: string) {
  // Some banks prefix the UPI block ("TO TRANSFER-UPI/DR/..."), and HDFC
  // separates fields with dashes instead of slashes.
  const start = narration.search(/UPI[/-]/i);
  if (start === -1) return { counterparty: narration.slice(0, 60) || null, note: null, ref: null };

  const block = narration.slice(start);
  const separator = block[3];
  const parts = block.split(separator).map((p) => p.trim()).filter(Boolean);

  const isRef = (p: string) => /^\d{10,14}$/.test(p);
  const isVpa = (p: string) => /^[\w.\-]+@[a-z]+$/i.test(p);
  const isIfsc = (p: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(p);
  const isNoise = (p: string) =>
    /^(DR|CR|P2A|P2M|UPI|NA)$/.test(p) || isRef(p) || isVpa(p) || isIfsc(p);
  // After the VPA, a bare four-letter code is the bank (SBIN, HDFC), not a note.
  const isBankCode = (p: string) => /^[A-Z]{4}$/.test(p);

  const ref = parts.find(isRef) ?? null;
  const vpa = parts.find(isVpa) ?? null;
  const vpaIndex = vpa ? parts.indexOf(vpa) : -1;

  // The payee name is the first real word ahead of the VPA; the bank code
  // that sometimes sits between them comes later, so taking the first wins.
  const name =
    parts.find((p, i) => i > 0 && (vpaIndex < 0 || i < vpaIndex) && !isNoise(p) && /[A-Za-z]{2}/.test(p)) ?? null;
  const trailing =
    vpaIndex >= 0
      ? parts.slice(vpaIndex + 1).filter((p) => !isNoise(p) && !isBankCode(p)).join(" ")
      : "";
  const note = trailing && !/^(payment from phone|upi)$/i.test(trailing) ? trailing : null;

  return { counterparty: name ?? vpa, note, ref };
}

export function toStatementRows(rows: Cell[][], headerIndex: number, map: ColumnMap): StatementRow[] {
  const out: StatementRow[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const date = map.date !== null ? parseDate(row[map.date]) : null;
    if (!date) continue;

    let direction: Direction;
    let amount: number;

    const debit = map.debit !== null ? parseAmount(row[map.debit]) : 0;
    const credit = map.credit !== null ? parseAmount(row[map.credit]) : 0;

    if (debit || credit) {
      direction = credit > 0 ? "in" : "out";
      amount = Math.abs(credit > 0 ? credit : debit);
    } else if (map.amount !== null) {
      const value = parseAmount(row[map.amount]);
      const marker = map.drcr !== null ? clean(row[map.drcr]) : "";
      const rawAmount = clean(row[map.amount]);
      const isDebit = /dr/i.test(marker) || /dr$/i.test(rawAmount) || value < 0;
      direction = isDebit ? "out" : "in";
      amount = Math.abs(value);
    } else {
      continue;
    }

    if (!amount) continue;

    const narration = map.narration !== null ? clean(row[map.narration]) : "";
    const parsed = parseNarration(narration);
    const refCell = map.ref !== null ? clean(row[map.ref]) : "";
    // The UPI ref inside the narration is what email alerts carry too, so it
    // wins — that way a statement import and an email import of the same
    // payment collide on bank_ref instead of doubling the ledger. Ref columns
    // like "TRANSFER TO 4897" are not unique per transaction and are skipped.
    const columnRef = /\d{6,}/.test(refCell)
      ? /^\d+$/.test(refCell)
        ? refCell.replace(/^0+/, "")
        : refCell
      : null;
    const ref = parsed.ref ?? columnRef;

    out.push({
      date,
      direction,
      amount: Math.round(amount * 100) / 100,
      narration,
      ref,
      counterparty: parsed.counterparty,
      note: parsed.note,
    });
  }

  return out;
}

/**
 * Statements without reference numbers still need a stable key so importing
 * the same file twice does not double the ledger.
 */
export function fallbackRef(row: Pick<StatementRow, "date" | "amount" | "direction" | "narration">) {
  const source = `${row.date}|${row.direction}|${row.amount.toFixed(2)}|${row.narration}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  return `STMT${(hash >>> 0).toString(36).toUpperCase()}`;
}
