import { parseBankAlert } from "../src/lib/bank-parser.ts";

const samples: { name: string; subject: string; body: string; expect: Partial<{ amount: number; direction: string }> }[] = [
  {
    name: "HDFC UPI debit",
    subject: "You have done a UPI txn. Check details!",
    body: `Dear Customer,
Rs.500.00 has been debited from account **1234 to VPA ramesh@okhdfcbank on 12-09-25.
Your UPI transaction reference number is 526312345678.`,
    expect: { amount: 500, direction: "out" },
  },
  {
    name: "SBI UPI debit",
    subject: "SBI Alert",
    body: `Dear UPI user A/C X1234 debited by 1250.0 on date 12Sep25 trf to PARK KENNEL Refno 526398765432. If not u? call 1800111109. -SBI`,
    expect: { amount: 1250, direction: "out" },
  },
  {
    name: "ICICI credit",
    subject: "Transaction alert",
    body: `Dear Customer, Acct XX456 is credited with INR 55,000.00 on 11-Sep-2025 from SABEEZ ENTERPRISES. UPI Ref no 526300011122. -ICICI Bank`,
    expect: { amount: 55000, direction: "in" },
  },
  {
    name: "Axis with narration",
    subject: "Debit alert",
    body: `<html><body><p>INR 2,340.50 debited from A/c no. XX7788 on 10-09-2025.
Narration: Promo work part payment. UPI/P2A/526355544433/RIO PRINTERS</p></body></html>`,
    expect: { amount: 2340.5, direction: "out" },
  },
  {
    name: "Kotak credit",
    subject: "Kotak Bank: Credit Alert",
    body: `Received Rs 7,500.00 in your Kotak Bank AC X9012 from 9876543210@ybl on 09-09-2025. UPI Ref: 526311122233.`,
    expect: { amount: 7500, direction: "in" },
  },
  {
    name: "Promotional junk",
    subject: "Get a personal loan at 9.99%",
    body: `Dear Customer, you are pre-approved for a loan. Apply now and enjoy low interest rates.`,
    expect: {},
  },
];

let failures = 0;
for (const sample of samples) {
  const result = parseBankAlert(sample.body, sample.subject);
  const ok =
    Object.keys(sample.expect).length === 0
      ? result === null
      : result !== null &&
        result.amount === sample.expect.amount &&
        result.direction === sample.expect.direction;

  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${sample.name}`);
  console.log(`      ${JSON.stringify(result)}`);
}

console.log(failures ? `\n${failures} failing` : "\nall passing");
