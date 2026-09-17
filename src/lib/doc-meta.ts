import type { DocType } from "@/lib/types";

export const DOC_META: Record<
  DocType,
  { base: string; label: string; partyRole: string; dueLabel: string }
> = {
  quotation: { base: "quotations", label: "Quotation", partyRole: "Quotation for", dueLabel: "Valid until" },
  invoice: { base: "invoices", label: "Invoice", partyRole: "Bill to", dueLabel: "Due date" },
  purchase_bill: { base: "bills", label: "Purchase Bill", partyRole: "Supplier", dueLabel: "Due date" },
};
