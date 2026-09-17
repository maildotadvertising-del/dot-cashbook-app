export type CompanyRole = "owner" | "admin" | "staff";
export type BrandRole = "admin" | "operator" | "viewer";
export type AccountType = "cash" | "bank" | "petty" | "wallet";
export type Direction = "in" | "out";
export type TxnSource = "manual" | "email" | "statement" | "transfer" | "document";
export type PartyType = "customer" | "supplier" | "both";
export type DocType = "quotation" | "invoice" | "purchase_bill";
export type DocStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "partial"
  | "paid"
  | "cancelled";

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface Brand {
  id: string;
  company_id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  state_code: string | null;
  invoice_prefix: string;
  quotation_prefix: string;
  is_active: boolean;
  sort_order: number;
}

export interface Profile {
  id: string;
  company_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: CompanyRole;
}

export interface BrandMember {
  brand_id: string;
  user_id: string;
  role: BrandRole;
  can_edit_entries: boolean;
  can_delete_entries: boolean;
  can_view_reports: boolean;
  can_see_others_entries: boolean;
  backdate_policy: "always" | "never" | "one_day";
}

export interface Account {
  id: string;
  brand_id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  account_last4: string | null;
  opening_balance: number;
  is_active: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  brand_id: string;
  name: string;
  kind: "income" | "expense" | "both";
}

export interface PaymentMode {
  id: string;
  brand_id: string;
  name: string;
}

export interface Party {
  id: string;
  brand_id: string;
  name: string;
  type: PartyType;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  state_code: string | null;
  opening_balance: number;
  notes: string | null;
}

export interface Transaction {
  id: string;
  brand_id: string;
  account_id: string;
  direction: Direction;
  amount: number;
  txn_date: string;
  txn_at: string;
  remark: string | null;
  party_id: string | null;
  category_id: string | null;
  payment_mode_id: string | null;
  bill_url: string | null;
  source: TxnSource;
  bank_ref: string | null;
  counterparty: string | null;
  needs_review: boolean;
  transfer_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TransactionRow extends Transaction {
  party: Pick<Party, "id" | "name" | "type"> | null;
  category: Pick<Category, "id" | "name"> | null;
  payment_mode: Pick<PaymentMode, "id" | "name"> | null;
  account: Pick<Account, "id" | "name" | "type"> | null;
}

export interface Transfer {
  id: string;
  company_id: string;
  from_brand_id: string;
  to_brand_id: string;
  from_transaction_id: string | null;
  to_transaction_id: string | null;
  amount: number;
  transfer_date: string;
  note: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  brand_id: string;
  name: string;
  kind: "product" | "service";
  description: string | null;
  hsn_sac: string | null;
  unit: string;
  rate: number;
  gst_rate: number;
  is_active: boolean;
}

export interface DocumentRecord {
  id: string;
  brand_id: string;
  doc_type: DocType;
  doc_number: string;
  party_id: string | null;
  doc_date: string;
  due_date: string | null;
  is_gst: boolean;
  gst_treatment: "intra" | "inter";
  place_of_supply: string | null;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off: number;
  total: number;
  amount_paid: number;
  status: DocStatus;
  notes: string | null;
  terms: string | null;
  converted_from: string | null;
  created_at: string;
}

export interface DocumentLine {
  id: string;
  document_id: string;
  item_id: string | null;
  name: string;
  description: string | null;
  hsn_sac: string | null;
  qty: number;
  unit: string | null;
  rate: number;
  discount_pct: number;
  gst_rate: number;
  amount: number;
  sort_order: number;
}

export interface EmailImport {
  id: string;
  brand_id: string | null;
  to_address: string | null;
  from_address: string | null;
  subject: string | null;
  raw_body: string | null;
  parsed: ParsedAlert | null;
  status: "pending" | "imported" | "failed" | "duplicate" | "ignored";
  transaction_id: string | null;
  error: string | null;
  received_at: string;
}

/** What a parsed bank/UPI alert email yields. */
export interface ParsedAlert {
  amount: number;
  direction: Direction;
  date: string | null;
  counterparty: string | null;
  note: string | null;
  bankRef: string | null;
  accountLast4: string | null;
  bank: string | null;
}
