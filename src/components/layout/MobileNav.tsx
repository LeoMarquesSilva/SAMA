"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  Menu,
  X,
} from "lucide-react";
import { mobileMenuItems, type NavItem } from "@/lib/nav-items";
import type { NavContext } from "@/lib/nav-access";
import { navOnboardingProps } from "@/lib/onboarding/nav-targets";

const mobileTabs: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/proximos-passos", label: "Passos", icon: ListChecks },
];

export function MobileNav({
  navContext,
  badges = {},
}: {
  isAdmin?: boolean;
  navContext: NavContext;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = mobileMenuItems(navContext);

  return (
    <>
      {menuOpen && (
        <MobileSheet title="Menu" onClose={() => setMenuOpen(false)}>
          <div className="grid grid-cols-2 gap-3">
            {menuItems.map((item) => (
              <MenuLink
                key={item.href}
                item={item}
                badge={badges[item.href]}
                active={isActive(pathname, item.href)}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
          </div>
        </MobileSheet>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {mobileTabs.map((tab) => (
          <TabLink
            key={tab.href}
            {...tab}
            active={isActive(pathname, tab.href)}
            badge={badges[tab.href]}
          />
        ))}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={clsx(
            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
            menuItems.some((i) => isActive(pathname, i.href))
              ? "text-brand-600"
              : "text-slate-400"
          )}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
          Menu
        </button>
      </nav>
    </>
  );
}

function MobileSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[min(85vh,520px)] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      {...navOnboardingProps(href)}
      className={clsx(
        "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
        active ? "text-brand-600" : "text-slate-400"
      )}
    >
      <span className="relative">
        <Icon size={22} />
        {badge ? (
          <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );
}

function MenuLink({
  item,
  badge,
  active,
  onNavigate,
}: {
  item: NavItem;
  badge?: number;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={clsx(
        "relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition active:scale-[0.98]",
        active
          ? "border-brand-300 bg-brand-50 text-brand-800"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50"
      )}
    >
      <Icon size={22} />
      <span className="text-sm font-medium leading-tight">{item.label}</span>
      {badge ? (
        <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
