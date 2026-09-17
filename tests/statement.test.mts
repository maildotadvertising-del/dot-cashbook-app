import { fallbackRef, findHeader, toStatementRows, type Cell } from "../src/lib/statement.ts";

let failures = 0;
function check(name: string, ok: boolean, detail: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`      ${JSON.stringify(detail)}`);
}

// HDFC-style: preamble lines, split withdrawal/deposit columns
const hdfc: Cell[][] = [
  ["HDFC BANK Ltd."],
  ["Account No: XXXXXXXX1234"],
  [],
  ["Date", "Narration", "Chq./Ref.No.", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
  ["12/09/25", "UPI-RAMESH K-ramesh@okhdfcbank-HDFC0001234-526312345678-Promo work", "0000526312345678", "12/09/25", "500.00", "", "10,500.00"],
  ["13/09/25", "UPI/526398765432/PARK KENNEL/parkkennel@ybl/Promo work part payment", "0000526398765432", "13/09/25", "", "55,000.00", "65,500.00"],
  ["", "", "", "", "", "", ""],
  ["STATEMENT SUMMARY"],
];

const h = findHeader(hdfc);
check("HDFC header found at row 3", h?.index === 3, h);
const hRows = h ? toStatementRows(hdfc, h.index, h.map) : [];
check("HDFC yields 2 rows", hRows.length === 2, hRows);
check("HDFC row1 debit 500", hRows[0]?.direction === "out" && hRows[0]?.amount === 500, hRows[0]);
check("HDFC row2 credit 55000", hRows[1]?.direction === "in" && hRows[1]?.amount === 55000, hRows[1]);
check(
  "HDFC dash-format narration",
  hRows[0]?.counterparty === "RAMESH K" && hRows[0]?.note === "Promo work",
  hRows[0],
);
check("HDFC row2 date", hRows[1]?.date === "2025-09-13", hRows[1]);
check(
  "HDFC row2 UPI note + counterparty",
  hRows[1]?.note === "Promo work part payment" && hRows[1]?.counterparty === "PARK KENNEL",
  hRows[1],
);

// SBI-style: single amount + Dr/Cr marker, month-name dates
const sbi: Cell[][] = [
  ["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Amount", "Dr / Cr", "Balance"],
  ["12 Sep 2025", "12 Sep 2025", "TO TRANSFER-UPI/DR/526311122233/RIO PRINT/SBIN/rio@sbi/Flex banner", "TRANSFER TO 4897", "2,340.50", "DR", "8,000.00"],
  ["14 Sep 2025", "14 Sep 2025", "BY TRANSFER-NEFT*HDFC*SABEEZ", "UTR123456", "7,500.00", "CR", "15,500.00"],
];
const s = findHeader(sbi);
const sRows = s ? toStatementRows(sbi, s.index, s.map) : [];
check("SBI yields 2 rows", sRows.length === 2, { map: s?.map, sRows });
check("SBI row1 debit 2340.50", sRows[0]?.direction === "out" && sRows[0]?.amount === 2340.5, sRows[0]);
check(
  "SBI prefixed UPI narration",
  sRows[0]?.counterparty === "RIO PRINT" && sRows[0]?.note === "Flex banner" && sRows[0]?.ref === "526311122233",
  sRows[0],
);
check("SBI UTR column ref", sRows[1]?.ref === "UTR123456", sRows[1]);
check("HDFC zero-padded ref normalised", hRows[0]?.ref === "526312345678", hRows[0]);
check("SBI row2 credit", sRows[1]?.direction === "in" && sRows[1]?.date === "2025-09-14", sRows[1]);

// Excel with real Date cells and numeric amounts
const excel: Cell[][] = [
  ["Transaction Date", "Particulars", "Debit", "Credit"],
  [new Date(2025, 8, 10), "Office rent", 12000, null],
  [45915, "Client payment", null, 3000],
];
const e = findHeader(excel);
const eRows = e ? toStatementRows(excel, e.index, e.map) : [];
check("Excel Date cell", eRows[0]?.date === "2025-09-10" && eRows[0]?.direction === "out", eRows[0]);
check("Excel serial date", eRows[1]?.date === "2025-09-15" && eRows[1]?.amount === 3000, eRows[1]);

check(
  "fallbackRef is stable",
  fallbackRef({ date: "2025-09-10", amount: 1, direction: "in", narration: "x" }) ===
    fallbackRef({ date: "2025-09-10", amount: 1, direction: "in", narration: "x" }),
  null,
);

console.log(failures ? `\n${failures} failing` : "\nall passing");
if (failures) process.exit(1);
