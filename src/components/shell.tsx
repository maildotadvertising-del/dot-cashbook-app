"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PieChart,
  Receipt,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import type { Brand, Profile } from "@/lib/types";

const BRAND_NAV = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "cashbook", label: "Cash Book", icon: BookOpen },
  { href: "parties", label: "Parties", icon: Users },
  { href: "items", label: "Items", icon: Package },
  { href: "quotations", label: "Quotations", icon: FileText },
  { href: "invoices", label: "Invoices", icon: Receipt },
  { href: "reports", label: "Reports", icon: PieChart },
  { href: "settings", label: "Settings", icon: Settings },
];

const COMPANY_NAV = [
  { href: "/overview", label: "All Brands", icon: Wallet },
  { href: "/transfers", label: "Fund Transfers", icon: ArrowLeftRight },
  { href: "/company", label: "Company", icon: Settings },
];

export function Shell({
  profile,
  brands,
  email,
  children,
}: {
  profile: Profile | null;
  brands: Brand[];
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const brandId = useMemo(() => {
    const match = pathname.match(/^\/b\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const activeBrand = brands.find((b) => b.id === brandId) ?? null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = activeBrand
    ? BRAND_NAV.map((item) => ({
        ...item,
        to: `/b/${activeBrand.id}/${item.href}`,
      }))
    : [];

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* ------------------------------------------------------------ sidebar */}
      <aside
        className={cn(
          "glass fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col gap-4 rounded-r-[26px] p-4 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[13px] bg-[var(--accent)] text-white">
              <Wallet className="size-5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">DOT Cash Book</span>
          </Link>
          <button
            className="btn btn-ghost !p-2 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* brand switcher */}
        <div className="relative">
          <button
            className="glass glass-hover flex w-full items-center gap-2.5 rounded-[16px] p-2.5 text-left"
            onClick={() => setSwitcherOpen((v) => !v)}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
              {initials(activeBrand?.name ?? "All")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {activeBrand?.name ?? "All Brands"}
              </span>
              <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                {activeBrand?.gstin ?? `${brands.length} brand${brands.length === 1 ? "" : "s"}`}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-[var(--fg-muted)]" />
          </button>

          {switcherOpen && (
            <div className="glass-strong absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-auto rounded-[18px] p-1.5">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/b/${brand.id}/dashboard`}
                  onClick={() => {
                    setSwitcherOpen(false);
                    setNavOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-[13px] px-2.5 py-2 text-sm hover:bg-[var(--accent-soft)]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">
                    {initials(brand.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{brand.name}</span>
                  {brand.id === brandId && <Check className="size-4 text-[var(--accent)]" />}
                </Link>
              ))}
              <Link
                href="/company/brands/new"
                onClick={() => setSwitcherOpen(false)}
                className="mt-1 block rounded-[13px] border-t border-[var(--hairline)] px-2.5 py-2 text-sm font-semibold text-[var(--accent)]"
              >
                + Add brand
              </Link>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-auto">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.href}
                href={item.to}
                onClick={() => setNavOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--accent)] text-white shadow-[0_8px_20px_-10px_var(--accent)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--fg)]",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-4 px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-subtle)]">
            Company
          </div>
          {COMPANY_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--accent)] text-white shadow-[0_8px_20px_-10px_var(--accent)]"
                    : "text-[var(--fg-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--fg)]",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="glass flex items-center gap-2.5 rounded-[16px] p-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
            {initials(profile?.full_name ?? email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">
              {profile?.full_name ?? "You"}
            </span>
            <span className="block truncate text-[11px] capitalize text-[var(--fg-muted)]">
              {profile?.role ?? "staff"}
            </span>
          </span>
          <button
            onClick={signOut}
            className="rounded-full p-1.5 text-[var(--fg-muted)] hover:bg-[var(--out-soft)] hover:text-[var(--out)]"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* --------------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center gap-3 px-4 py-3 lg:hidden">
          <button
            className="btn btn-ghost !p-2"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="truncate text-sm font-semibold">
            {activeBrand?.name ?? "DOT Cash Book"}
          </span>
        </header>

        <main className="min-w-0 flex-1 p-4 pb-24 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
