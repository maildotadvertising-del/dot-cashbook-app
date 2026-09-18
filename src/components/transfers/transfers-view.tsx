"use client";

import { useState } from "react";
import { ArrowLeftRight, ArrowRight, Plus } from "lucide-react";
import { EmptyState, GlassCard, PageHeader, Pill } from "@/components/ui";
import { TransferModal } from "@/components/transfers/transfer-modal";
import { formatDate, money } from "@/lib/utils";
import type { Account, Brand, Transfer } from "@/lib/types";

export function TransfersView({
  brandId,
  brands,
  accounts,
  transfers,
}: {
  brandId: string;
  brands: Brand[];
  accounts: Account[];
  transfers: Transfer[];
}) {
  const [open, setOpen] = useState(false);
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? null;

  return (
    <div>
      <PageHeader
        title="Fund Transfers"
        subtitle="Between your own accounts, or across brands — both sides update together"
        actions={
          <button className="btn btn-accent" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New transfer
          </button>
        }
      />

      {!transfers.length ? (
        <GlassCard>
          <EmptyState
            icon={<ArrowLeftRight className="size-9" />}
            title="No transfers yet"
            description="Deposit cash into the bank, move money to petty cash, or send funds to another brand."
            action={
              <button className="btn btn-accent" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> New transfer
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {transfers.map((t) => {
            const internal = t.from_brand_id === t.to_brand_id;
            const from = internal ? accountName(t.from_account_id) : brandName(t.from_brand_id);
            const to = internal ? accountName(t.to_account_id) : brandName(t.to_brand_id);
            return (
              <GlassCard key={t.id} className="flex flex-wrap items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                  <span className="truncate font-medium">{from ?? "—"}</span>
                  <ArrowRight className="size-4 shrink-0 text-[var(--fg-muted)]" />
                  <span className="truncate font-medium">{to ?? "—"}</span>
                  <Pill tone={internal ? "neutral" : "special"}>{internal ? "accounts" : "brands"}</Pill>
                </span>
                <span className="text-right">
                  <span className="money block text-sm text-[var(--accent)]">₹{money(t.amount)}</span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">{formatDate(t.transfer_date)}</span>
                </span>
                {t.note && <span className="w-full truncate text-xs text-[var(--fg-muted)]">{t.note}</span>}
              </GlassCard>
            );
          })}
        </div>
      )}

      <TransferModal
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        brandId={brandId}
        brands={brands}
        accounts={accounts}
      />
    </div>
  );
}
