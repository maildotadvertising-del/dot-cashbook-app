"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileText,
  LayoutGrid,
  LogOut,
  Package,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import type { BrandPermissions } from "@/lib/permissions";
import type { Brand, Profile } from "@/lib/types";

type Need = "reports" | "manage";

interface Tab {
  href: string;
  label: string;
  needs?: Need;
}

interface Workspace {
  id: "items" | "sales" | "accounts";
  label: string;
  /** Dock label — short enough for three tabs on a phone. */
  short: string;
  icon: typeof Package;
  tabs: Tab[];
}

/**
 * Three DaVinci-style workspaces, switched from the bottom bar. Each one owns
 * its own sub-pages and its own settings, so nothing from one leaks into
 * another's screens.
 */
const WORKSPACES: Workspace[] = [
  {
    id: "items",
    label: "Items",
    short: "Items",
    icon: Package,
    tabs: [
      { href: "items", label: "Products & Services" },
      { href: "items/settings", label: "Settings", needs: "manage" },
    ],
  },
  {
    id: "sales",
    label: "Quotation & Invoices",
    short: "Quotes & Invoices",
    icon: FileText,
    tabs: [
      { href: "invoices", label: "Invoices" },
      { href: "quotations", label: "Quotations" },
      { href: "sales/settings", label: "Settings", needs: "manage" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    short: "Accounts",
    icon: Wallet,
    tabs: [
      { href: "dashboard", label: "Dashboard", needs: "reports" },
      { href: "cashbook", label: "Cash Book" },
      { href: "parties", label: "Parties" },
      { href: "bills", label: "Purchase Bills" },
      { href: "transfers", label: "Fund Transfers" },
      { href: "recurring", label: "Recurring" },
      { href: "review", label: "Review", needs: "manage" },
      { href: "reports", label: "Reports", needs: "reports" },
      { href: "settings", label: "Settings", needs: "manage" },
    ],
  },
];

function workspaceFor(section: string): Workspace["id"] {
  if (section === "items") return "items";
  if (["invoices", "quotations", "sales"].includes(section)) return "sales";
  return "accounts";
}

export function Shell({
  profile,
  brands,
  permissions,
  email,
  children,
}: {
  profile: Profile | null;
  brands: Brand[];
  permissions: BrandPermissions[];
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [brandMenu, setBrandMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menusRef = useRef<HTMLDivElement>(null);

  const match = pathname.match(/^\/b\/([^/]+)(?:\/(.*))?/);
  const brandIdInPath = match?.[1] ?? null;
  const rest = match?.[2] ?? "";
  const section = rest.split("/")[0] ?? "";

  // Company-level pages (Team, All Brands) have no brand in the URL; the
  // bottom bar still needs somewhere to go, so it falls back to the first.
  const activeBrand =
    brands.find((b) => b.id === brandIdInPath) ?? (brandIdInPath ? null : brands[0] ?? null);
  const perms = permissions.find((p) => p.brand_id === activeBrand?.id);
  const isAdmin = profile?.role === "owner" || profile?.role === "admin";

  const allowed = (needs?: Need) =>
    !needs ||
    (needs === "reports" && !!perms?.can_reports) ||
    (needs === "manage" && !!perms?.can_manage);

  const currentWs = brandIdInPath ? workspaceFor(section) : null;
  const workspace = WORKSPACES.find((w) => w.id === currentWs) ?? null;
  const activeIndex = WORKSPACES.findIndex((w) => w.id === currentWs);
  const tabs = workspace?.tabs.filter((t) => allowed(t.needs)) ?? [];

  // Longest matching tab wins, so "items/settings" beats "items".
  const activeTab = useMemo(() => {
    const matches = tabs.filter((t) => rest === t.href || rest.startsWith(`${t.href}/`));
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  }, [tabs, rest]);

  const homeFor = (ws: Workspace) =>
    ws.tabs.find((t) => allowed(t.needs))?.href ?? ws.tabs[0].href;

  useEffect(() => {
    if (!brandMenu && !userMenu) return;
    const close = (e: MouseEvent) => {
      if (!menusRef.current?.contains(e.target as Node)) {
        setBrandMenu(false);
        setUserMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [brandMenu, userMenu]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const closeMenus = () => {
    setBrandMenu(false);
    setUserMenu(false);
  };

  return (
    <div className="relative z-[1] flex min-h-dvh flex-col">
      {/* ------------------------------------------------------------ top bar */}
      <header
        ref={menusRef}
        className="sticky top-0 z-30 border-b-[0.5px] border-white/[0.08] bg-[var(--nav-bg)] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-[30px] backdrop-saturate-[180%]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/"
            className="grid size-9 shrink-0 place-items-center rounded-[12px] text-white shadow-[0_8px_24px_rgba(10,132,255,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]"
            style={{ background: "linear-gradient(145deg,rgba(10,132,255,0.85),rgba(10,60,180,0.9))" }}
            aria-label="Home"
          >
            <Wallet className="size-[18px]" />
          </Link>

          <div className="relative min-w-0">
            <button
              onClick={() => {
                setBrandMenu((v) => !v);
                setUserMenu(false);
              }}
              className="flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 hover:bg-white/5"
            >
              <span className="min-w-0 text-left">
                <span className="block text-[9px] uppercase tracking-[3px] text-[var(--fg-muted)]">
                  Zeebas Cluster
                </span>
                <span className="block truncate text-sm font-medium">
                  {activeBrand?.name ?? "All Brands"}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-[var(--fg-muted)]" />
            </button>

            {brandMenu && (
              <div className="menu absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-[13px] p-1.5">
                {brands.map((brand) => (
                  <Link
                    key={brand.id}
                    onClick={closeMenus}
                    href={`/b/${brand.id}/${brandIdInPath && rest ? rest.split("/")[0] : "cashbook"}`}
                    className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm hover:bg-white/5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[var(--accent-soft)] text-[10px] font-medium text-[var(--accent)]">
                      {initials(brand.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{brand.name}</span>
                    {brand.id === activeBrand?.id && <Check className="size-4 text-[var(--accent)]" />}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/company/brands/new"
                    onClick={closeMenus}
                    className="mt-1 flex items-center gap-2 border-t-[0.5px] border-[var(--hairline)] px-2.5 pb-1.5 pt-2.5 text-sm font-medium text-[var(--accent)]"
                  >
                    <Plus className="size-4" /> Add brand
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="relative ml-auto">
            <button
              onClick={() => {
                setUserMenu((v) => !v);
                setBrandMenu(false);
              }}
              className="grid size-9 place-items-center rounded-full bg-[var(--special-soft)] text-xs font-medium text-[var(--special)]"
              aria-label="Account menu"
            >
              {initials(profile?.full_name ?? email)}
            </button>

            {userMenu && (
              <div className="menu absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-[13px] p-1.5">
                <div className="px-2.5 pb-2 pt-1.5">
                  <p className="truncate text-sm font-medium">{profile?.full_name ?? email}</p>
                  <p className="truncate text-xs capitalize text-[var(--fg-muted)]">
                    {profile?.role ?? "staff"}
                  </p>
                </div>
                <div className="border-t-[0.5px] border-[var(--hairline)] pt-1">
                  <MenuLink href="/company" icon={Users} label="Team & brands" onClick={closeMenus} />
                  {isAdmin && (
                    <MenuLink href="/overview" icon={LayoutGrid} label="All brands overview" onClick={closeMenus} />
                  )}
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm text-[var(--out)] hover:bg-[var(--out-soft)]"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* workspace sub-pages */}
        {tabs.length > 0 && activeBrand && (
          <nav className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none]">
            {tabs.map((tab) => {
              const active = tab.href === activeTab;
              return (
                <Link
                  key={tab.href}
                  href={`/b/${activeBrand.id}/${tab.href}`}
                  className={cn(
                    "shrink-0 rounded-full border-[0.5px] px-4 py-1.5 text-[12.5px] transition-all duration-300",
                    active
                      ? "border-[var(--accent-line)] bg-[linear-gradient(180deg,rgba(10,132,255,0.28),rgba(10,132,255,0.14))] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_-6px_rgba(10,132,255,0.6)]"
                      : "border-white/[0.08] bg-white/[0.04] font-medium text-[var(--fg-muted)] hover:bg-white/[0.08] hover:text-[var(--fg)]",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="relative mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-32 pt-5 lg:px-5">
        {children}
      </main>

      {/* ---------------------------------- floating dock (iOS-style tab bar) */}
      {activeBrand && (
        <nav
          aria-label="Workspaces"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="glass pointer-events-auto relative grid w-full max-w-[420px] grid-cols-3 rounded-full p-1.5 !shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]">
            {/* The lens: a brighter glass pill that springs to the active tab. */}
            {activeIndex >= 0 && (
              <span
                aria-hidden
                className="absolute bottom-1.5 left-1.5 top-1.5 rounded-full border-[0.5px] border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_-6px_rgba(10,132,255,0.5)] transition-transform duration-500 [transition-timing-function:var(--spring)]"
                style={{ width: "calc((100% - 12px) / 3)", transform: `translateX(${activeIndex * 100}%)` }}
              />
            )}
            {WORKSPACES.map((ws) => {
              const active = ws.id === currentWs;
              return (
                <Link
                  key={ws.id}
                  href={`/b/${activeBrand.id}/${homeFor(ws)}`}
                  className={cn(
                    "relative z-10 flex flex-col items-center gap-0.5 rounded-full px-2 py-2 transition-colors duration-300",
                    active ? "text-[var(--accent)]" : "text-[var(--inactive-icon)] hover:text-[var(--fg)]",
                  )}
                >
                  <ws.icon
                    className={cn("size-[21px] transition-transform duration-500 [transition-timing-function:var(--spring)]", active && "scale-110")}
                    strokeWidth={active ? 2.1 : 1.8}
                  />
                  <span className={cn("text-[10.5px] leading-tight tracking-[-0.01em]", active ? "font-semibold" : "font-medium")}>
                    {ws.short}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm hover:bg-white/5"
    >
      <Icon className="size-4 text-[var(--fg-muted)]" /> {label}
    </Link>
  );
}
