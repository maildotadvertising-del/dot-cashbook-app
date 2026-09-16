export interface LineInput {
  qty: number;
  rate: number;
  discount_pct?: number;
  gst_rate?: number;
}

export interface DocTotals {
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
  taxBreakup: { gst_rate: number; taxable: number; cgst: number; sgst: number; igst: number }[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineAmount(line: LineInput) {
  const gross = (Number(line.qty) || 0) * (Number(line.rate) || 0);
  const discount = gross * ((Number(line.discount_pct) || 0) / 100);
  return round2(gross - discount);
}

export function lineDiscount(line: LineInput) {
  const gross = (Number(line.qty) || 0) * (Number(line.rate) || 0);
  return round2(gross * ((Number(line.discount_pct) || 0) / 100));
}

/**
 * Intra-state supply splits tax into CGST + SGST; inter-state charges IGST.
 * A non-GST invoice skips tax entirely.
 */
export function computeTotals(
  lines: LineInput[],
  opts: { isGst: boolean; treatment: "intra" | "inter" },
): DocTotals {
  const byRate = new Map<number, number>();
  let subtotal = 0;
  let discount = 0;

  for (const line of lines) {
    const amount = lineAmount(line);
    subtotal += amount;
    discount += lineDiscount(line);
    if (opts.isGst) {
      const rate = Number(line.gst_rate) || 0;
      byRate.set(rate, round2((byRate.get(rate) ?? 0) + amount));
    }
  }

  subtotal = round2(subtotal);
  discount = round2(discount);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  const taxBreakup: DocTotals["taxBreakup"] = [];

  if (opts.isGst) {
    for (const [rate, taxable] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
      if (!rate) continue;
      const tax = round2((taxable * rate) / 100);
      const half = round2(tax / 2);
      const row =
        opts.treatment === "inter"
          ? { gst_rate: rate, taxable, cgst: 0, sgst: 0, igst: tax }
          : { gst_rate: rate, taxable, cgst: half, sgst: round2(tax - half), igst: 0 };

      taxBreakup.push(row);
      cgst += row.cgst;
      sgst += row.sgst;
      igst += row.igst;
    }
  }

  cgst = round2(cgst);
  sgst = round2(sgst);
  igst = round2(igst);

  const raw = round2(subtotal + cgst + sgst + igst);
  const total = Math.round(raw);
  const roundOff = round2(total - raw);

  return { subtotal, discount, cgst, sgst, igst, roundOff, total, taxBreakup };
}

/** GSTIN characters 1-2 are the state code, so a mismatch means inter-state. */
export function treatmentFor(
  brandStateOrGstin: string | null | undefined,
  partyStateOrGstin: string | null | undefined,
): "intra" | "inter" {
  const code = (value: string | null | undefined) => {
    if (!value) return null;
    const trimmed = value.trim();
    return /^\d{2}/.test(trimmed) ? trimmed.slice(0, 2) : null;
  };

  const a = code(brandStateOrGstin);
  const b = code(partyStateOrGstin);
  if (!a || !b) return "intra";
  return a === b ? "intra" : "inter";
}

export function isValidGstin(value: string) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][Z][0-9A-Z]$/.test(value.trim().toUpperCase());
}
