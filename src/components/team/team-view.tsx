"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, Plus, ShieldCheck, UserPlus, X } from "lucide-react";
import { EmptyState, Field, GlassCard, Modal, PageHeader, Pill } from "@/components/ui";
import {
  inviteMember,
  revokeInvite,
  setBrandAccess,
  setCompanyRole,
  type BrandAccess,
} from "@/app/actions/team";
import { cn, formatDate, initials } from "@/lib/utils";
import type { Brand, BrandMember, BrandRole, Profile } from "@/lib/types";

interface Invite {
  id: string;
  email: string;
  role: string;
  brand_ids: string[];
  brand_role: string;
  created_at: string;
}

const DEFAULT_ACCESS: BrandAccess = {
  role: "operator",
  can_edit_entries: true,
  can_delete_entries: false,
  can_view_reports: true,
  can_see_others_entries: true,
  backdate_policy: "always",
};

const ROLE_HELP: Record<BrandRole, string> = {
  admin: "Everything in this brand",
  operator: "Adds entries; the switches below fine-tune the rest",
  viewer: "Read-only",
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="glass flex gap-1 rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            value === option.value ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3 py-1.5 text-sm", disabled && "opacity-45")}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition",
          checked ? "bg-[var(--accent)]" : "bg-[var(--hairline)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}

export function TeamView({
  companyName,
  currentUserId,
  canManage,
  brands,
  members,
  access,
  invites,
}: {
  companyName: string;
  currentUserId: string;
  canManage: boolean;
  brands: Brand[];
  members: Profile[];
  access: BrandMember[];
  invites: Invite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [inviteBrands, setInviteBrands] = useState<string[]>([]);
  const [inviteBrandRole, setInviteBrandRole] = useState<BrandRole>("operator");

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editBrand, setEditBrand] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrandAccess | null>(null);

  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "Removed brand";
  const accessFor = (userId: string) => access.filter((a) => a.user_id === userId);

  async function sendInvite() {
    if (inviteRole === "staff" && !inviteBrands.length) {
      return toast.error("Pick at least one brand for staff");
    }
    setBusy(true);
    const result = await inviteMember({
      email,
      role: inviteRole,
      brand_ids: inviteBrands,
      brand_role: inviteBrandRole,
    });
    setBusy(false);
    if (result.error) return toast.error(result.error);

    toast.success(`Invite saved — ask ${email} to sign up with this email`);
    setInviteOpen(false);
    setEmail("");
    setInviteBrands([]);
    router.refresh();
  }

  function openBrand(brandId: string) {
    if (!editing) return;
    const current = access.find((a) => a.user_id === editing.id && a.brand_id === brandId);
    setEditBrand(brandId);
    setDraft(current ? { ...current } : null);
  }

  async function saveBrandAccess(next: BrandAccess | null) {
    if (!editing || !editBrand) return;
    setBusy(true);
    const result = await setBrandAccess(editing.id, editBrand, next);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success(next ? "Access saved" : "Access removed");
    setEditBrand(null);
    router.refresh();
  }

  async function changeRole(member: Profile, role: "admin" | "staff") {
    setBusy(true);
    const result = await setCompanyRole(member.id, role);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success(`${member.full_name ?? member.email} is now ${role}`);
    setEditing({ ...member, role });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={companyName}
        subtitle={`${brands.length} brands · ${members.length} people`}
        actions={
          canManage && (
            <button className="btn btn-accent" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" /> Invite
            </button>
          )
        }
      />

      <GlassCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Brands</h2>
          {canManage && (
            <Link href="/company/brands/new" className="btn btn-ghost !px-3 !py-1.5">
              <Plus className="size-4" /> Add
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/b/${brand.id}/settings`}
              className="glass glass-hover flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm"
            >
              <span className="grid size-7 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">
                {initials(brand.name)}
              </span>
              {brand.name}
            </Link>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="mt-3">
        <h2 className="mb-3 text-sm font-semibold">People</h2>
        <div className="flex flex-col divide-y divide-[var(--hairline)]">
          {members.map((member) => {
            const memberAccess = accessFor(member.id);
            const fullAccess = member.role === "owner" || member.role === "admin";
            return (
              <button
                key={member.id}
                disabled={!canManage || member.role === "owner" || member.id === currentUserId}
                onClick={() => setEditing(member)}
                className="flex items-center gap-3 py-3 text-left enabled:hover:opacity-80"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                  {initials(member.full_name ?? member.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {member.full_name ?? member.email ?? "Unnamed"}
                    {member.id === currentUserId && (
                      <span className="text-[var(--fg-muted)]"> (you)</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">
                    {fullAccess
                      ? "All brands"
                      : memberAccess.length
                        ? memberAccess.map((a) => `${brandName(a.brand_id)} · ${a.role}`).join(", ")
                        : "No brand access yet"}
                  </span>
                </span>
                <Pill tone={member.role === "staff" ? "neutral" : "accent"}>{member.role}</Pill>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {canManage && (
        <GlassCard className="mt-3">
          <h2 className="mb-1 text-sm font-semibold">Pending invites</h2>
          <p className="mb-3 text-xs text-[var(--fg-muted)]">
            Only invited emails can join. They sign up on the login page with the same email and
            land straight in their brands.
          </p>
          {!invites.length ? (
            <EmptyState title="No pending invites" icon={<Clock className="size-7" />} />
          ) : (
            <div className="flex flex-col divide-y divide-[var(--hairline)]">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{invite.email}</span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {invite.role === "admin"
                        ? "Admin · all brands"
                        : `${invite.brand_ids.map(brandName).join(", ")} · ${invite.brand_role}`}
                      {" · "}
                      {formatDate(invite.created_at)}
                    </span>
                  </span>
                  <button
                    className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)]"
                    aria-label={`Revoke invite for ${invite.email}`}
                    onClick={async () => {
                      const result = await revokeInvite(invite.id);
                      if (result.error) return toast.error(result.error);
                      router.refresh();
                    }}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* ------------------------------------------------------------- invite */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite someone">
        <div className="flex flex-col gap-3.5">
          <Field label="Email">
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoFocus
            />
          </Field>

          <Field label="Company role">
            <Segmented
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { value: "staff", label: "Staff" },
                { value: "admin", label: "Admin (all brands)" },
              ]}
            />
          </Field>

          {inviteRole === "staff" && (
            <>
              <Field label="Brands">
                <div className="flex flex-wrap gap-1.5">
                  {brands.map((brand) => {
                    const on = inviteBrands.includes(brand.id);
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() =>
                          setInviteBrands((current) =>
                            on ? current.filter((id) => id !== brand.id) : [...current, brand.id],
                          )
                        }
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          on ? "bg-[var(--accent)] text-white" : "bg-[var(--hairline)] text-[var(--fg-muted)]",
                        )}
                      >
                        {brand.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Role in those brands" hint={ROLE_HELP[inviteBrandRole]}>
                <Segmented
                  value={inviteBrandRole}
                  onChange={setInviteBrandRole}
                  options={[
                    { value: "operator", label: "Operator" },
                    { value: "viewer", label: "Viewer" },
                    { value: "admin", label: "Brand admin" },
                  ]}
                />
              </Field>
            </>
          )}

          <button className="btn btn-accent mt-1" onClick={sendInvite} disabled={busy || !email.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Save invite
          </button>
        </div>
      </Modal>

      {/* ------------------------------------------------------ member access */}
      <Modal
        open={editing !== null && editBrand === null}
        onClose={() => setEditing(null)}
        title={editing?.full_name ?? editing?.email ?? "Member"}
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Field label="Company role">
              <Segmented
                value={editing.role === "admin" ? "admin" : "staff"}
                onChange={(role) => role !== editing.role && changeRole(editing, role)}
                options={[
                  { value: "staff", label: "Staff" },
                  { value: "admin", label: "Admin (all brands)" },
                ]}
              />
            </Field>

            {editing.role === "admin" ? (
              <p className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                <ShieldCheck className="size-4 text-[var(--accent)]" />
                Admins have full access to every brand.
              </p>
            ) : (
              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--fg-muted)]">Brand access</p>
                <div className="flex flex-col divide-y divide-[var(--hairline)]">
                  {brands.map((brand) => {
                    const current = access.find(
                      (a) => a.user_id === editing.id && a.brand_id === brand.id,
                    );
                    return (
                      <button
                        key={brand.id}
                        onClick={() => openBrand(brand.id)}
                        className="flex items-center justify-between py-2.5 text-left text-sm hover:opacity-80"
                      >
                        {brand.name}
                        <Pill tone={current ? "accent" : "neutral"}>{current?.role ?? "no access"}</Pill>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={editBrand !== null}
        onClose={() => setEditBrand(null)}
        title={editBrand ? brandName(editBrand) : ""}
      >
        {!draft ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--fg-muted)]">
              {editing?.full_name ?? editing?.email} can&apos;t see this brand yet.
            </p>
            <button className="btn btn-accent" onClick={() => setDraft({ ...DEFAULT_ACCESS })}>
              <Plus className="size-4" /> Give access
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Role" hint={ROLE_HELP[draft.role]}>
              <Segmented
                value={draft.role}
                onChange={(role) => setDraft({ ...draft, role })}
                options={[
                  { value: "operator", label: "Operator" },
                  { value: "viewer", label: "Viewer" },
                  { value: "admin", label: "Brand admin" },
                ]}
              />
            </Field>

            {draft.role === "operator" && (
              <div className="glass rounded-[16px] px-3.5 py-2">
                <Toggle
                  label="Edit their own entries"
                  checked={draft.can_edit_entries}
                  onChange={(v) => setDraft({ ...draft, can_edit_entries: v })}
                />
                <Toggle
                  label="Delete their own entries"
                  checked={draft.can_delete_entries}
                  onChange={(v) => setDraft({ ...draft, can_delete_entries: v })}
                />
                <Toggle
                  label="See entries by others"
                  checked={draft.can_see_others_entries}
                  onChange={(v) => setDraft({ ...draft, can_see_others_entries: v })}
                />
                <Toggle
                  label="See balances & reports"
                  checked={draft.can_view_reports}
                  onChange={(v) => setDraft({ ...draft, can_view_reports: v })}
                />
              </div>
            )}

            {draft.role !== "admin" && (
              <Field label="Backdated entries">
                <Segmented
                  value={draft.backdate_policy}
                  onChange={(backdate_policy) => setDraft({ ...draft, backdate_policy })}
                  options={[
                    { value: "always", label: "Any date" },
                    { value: "one_day", label: "Up to yesterday" },
                    { value: "never", label: "Today only" },
                  ]}
                />
              </Field>
            )}

            <div className="mt-1 flex gap-2">
              {access.some((a) => a.user_id === editing?.id && a.brand_id === editBrand) && (
                <button
                  className="btn btn-ghost text-[var(--out)]"
                  onClick={() => saveBrandAccess(null)}
                  disabled={busy}
                >
                  Remove access
                </button>
              )}
              <button className="btn btn-accent flex-1" onClick={() => saveBrandAccess(draft)} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
