import type { Direction, ParsedAlert } from "@/lib/types";

const CREDIT_WORDS = /\b(credited|received|deposited|credit)\b/i;
const DEBIT_WORDS = /\b(debited|debit|withdrawn|paid|sent|spent|transferred to)\b/i;

const AMOUNT_PATTERNS = [
  /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited)\s+(?:by|with|for)\s+(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b([\d,]+\.\d{2})\b/,
];

const REF_PATTERNS = [
  /\b(?:UPI(?:\s*(?:transaction)?\s*(?:ref(?:erence)?)?\s*(?:no|number|id)?)|ref(?:erence)?\s*(?:no|number|id)?)\.?\s*:?\s*([A-Za-z0-9]{6,25})\b/i,
  /\bRefno\.?\s*([A-Za-z0-9]{6,25})\b/i,
  /\b(?:IMPS|NEFT|RTGS|UPI)[\s/-]*(?:Ref(?:erence)?\s*(?:no)?\.?)?\s*:?\s*([A-Za-z0-9]{8,25})\b/i,
  /\b(\d{12})\b/,
];

const VPA_PATTERN = /\b([\w.\-]{2,}@[a-z]{2,})\b/i;

const NAME_PATTERNS = [
  /\b(?:trf(?:\s+to)?|transfer(?:red)?\s+to|paid\s+to|to\s+VPA|sent\s+to)\s+([A-Za-z0-9 .&'\-]{2,40})/i,
  /\b(?:from|by)\s+VPA\s+([\w.\-]+@[\w]+)/i,
  /\bfrom\s+([A-Z][A-Za-z0-9 .&'\-]{2,40})\s+(?:on|Ref)/,
];

const ACCOUNT_PATTERNS = [
  /\b(?:a\/?c|acct|account)\s*(?:no\.?)?\s*[:\s]*[xX*]+(\d{3,4})\b/i,
  /\b[xX*]{2,}(\d{3,4})\b/,
];

const DATE_PATTERNS: [RegExp, (m: RegExpMatchArray) => string | null][] = [
  // 12-09-2025 / 12/09/25
  [
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    (m) => isoFrom(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  ],
  // 12-Sep-25 / 12 Sep 2025 / 12Sep25
  [
    /\b(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{2,4})\b/,
    (m) => {
      const month = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
      return month < 0 ? null : isoFrom(Number(m[1]), month, Number(m[3]));
    },
  ],
  // 2025-09-12
  [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const BANKS: [RegExp, string][] = [
  [/\bHDFC\b/i, "HDFC Bank"],
  [/\bICICI\b/i, "ICICI Bank"],
  [/\bSBI\b|State Bank/i, "State Bank of India"],
  [/\bAxis\b/i, "Axis Bank"],
  [/\bKotak\b/i, "Kotak Mahindra Bank"],
  [/\bIndusInd\b/i, "IndusInd Bank"],
  [/\bYes Bank\b/i, "Yes Bank"],
  [/\bIDFC\b/i, "IDFC First Bank"],
  [/\bIndian Bank\b/i, "Indian Bank"],
  [/\bCanara\b/i, "Canara Bank"],
  [/\bUnion Bank\b/i, "Union Bank of India"],
  [/\bPNB\b|Punjab National/i, "Punjab National Bank"],
];

function isoFrom(day: number, monthIndex: number, year: number) {
  const fullYear = year < 100 ? 2000 + year : year;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(fullYear, monthIndex, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function firstMatch(text: string, patterns: RegExp[], accept?: (value: string) => boolean) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value && (!accept || accept(value))) return value;
  }
  return null;
}

/** A reference is digits, or digits mixed with letters — never a bare word. */
function looksLikeRef(value: string) {
  return /\d/.test(value) && /^[A-Za-z0-9]{6,25}$/.test(value);
}

/** Strips HTML and collapses whitespace so the patterns see one clean line. */
export function normalizeBody(body: string) {
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;|&rupee;/gi, "₹")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pulls a transaction out of a bank/UPI alert email. Returns null when the
 * mail does not look like a transaction alert at all, so the caller can park
 * it for review instead of inventing an entry.
 */
export function parseBankAlert(rawBody: string, subject = ""): ParsedAlert | null {
  const text = `${normalizeBody(subject)} ${normalizeBody(rawBody)}`.trim();
  if (!text) return null;

  const amountRaw = firstMatch(text, AMOUNT_PATTERNS);
  if (!amountRaw) return null;

  const amount = Number(amountRaw.replace(/,/g, ""));
  if (!amount || Number.isNaN(amount) || amount <= 0) return null;

  const creditAt = text.search(CREDIT_WORDS);
  const debitAt = text.search(DEBIT_WORDS);
  if (creditAt === -1 && debitAt === -1) return null;

  // Whichever word appears first describes this account's side of the entry:
  // "A/c debited ... beneficiary credited" is a debit for us.
  let direction: Direction;
  if (creditAt === -1) direction = "out";
  else if (debitAt === -1) direction = "in";
  else direction = debitAt < creditAt ? "out" : "in";

  let date: string | null = null;
  for (const [pattern, build] of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      date = build(match);
      if (date) break;
    }
  }

  const vpa = text.match(VPA_PATTERN)?.[1] ?? null;
  const name = cleanName(firstMatch(text, NAME_PATTERNS));
  // A VPA that starts with the matched name is the fuller version of it.
  const counterparty =
    vpa && (!name || vpa.toLowerCase().startsWith(name.toLowerCase())) ? vpa : (name ?? vpa);

  return {
    amount,
    direction,
    date,
    counterparty,
    note: extractNote(text) ?? counterparty,
    bankRef: firstMatch(text, REF_PATTERNS, looksLikeRef),
    accountLast4: firstMatch(text, ACCOUNT_PATTERNS),
    bank: BANKS.find(([pattern]) => pattern.test(text))?.[1] ?? null,
  };
}

function cleanName(value: string | null) {
  if (!value) return null;
  const trimmed = value
    .replace(/\b(on|ref|refno|reference|upi|imps|neft|dated?)\b.*$/i, "")
    .trim()
    .replace(/[.,;]+$/, "")
    .trim();
  return trimmed.length > 1 ? trimmed : null;
}

/**
 * The remark a payer typed in their UPI app, when the bank passes it through.
 * Different banks label it differently, hence several shapes.
 */
function extractNote(text: string) {
  const patterns = [
    /\b(?:remark|remarks|narration|note|description|purpose)\s*[:\-]\s*([^.|]{2,80})/i,
    /\bUPI\/[A-Z0-9]+\/\d+\/[^/]+\/[^/]+\/([^/|.]{2,60})/i,
  ];
  const found = firstMatch(text, patterns);
  return found ? found.trim() : null;
}
