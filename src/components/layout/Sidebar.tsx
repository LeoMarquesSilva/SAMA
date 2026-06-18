"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { APP_FULL_NAME, APP_NAME } from "@/lib/constants";
import { NAV_BRAND, visibleNavItems } from "@/lib/nav-items";
import type { NavContext } from "@/lib/nav-access";
import { navOnboardingProps } from "@/lib/onboarding/nav-targets";

export function Sidebar({
  badges = {},
  navContext,
}: {
  badges?: Record<string, number>;
  navContext: NavContext;
}) {
  const pathname = usePathname();
  const visibleItems = visibleNavItems(navContext);
  const BrandIcon = NAV_BRAND.icon;

  return (
    <>
      <div aria-hidden className="hidden w-[72px] shrink-0 md:block print:hidden" />

      <aside
        className={clsx(
          "group fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-slate-200",
          "bg-white/90 backdrop-blur-xl transition-[width] duration-300 ease-out",
          "hover:w-64 hover:shadow-xl hover:shadow-slate-900/5",
          "md:flex print:hidden"
        )}
      >
        <div className="flex h-16 items-center px-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
            <BrandIcon size={18} />
          </div>
          <div className="ml-3 overflow-hidden opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="text-sm font-bold leading-tight text-slate-800">
              {APP_NAME}
            </p>
            <p className="text-[11px] leading-snug text-slate-400">
              {APP_FULL_NAME}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || pathname.startsWith(href + "/");
            const badge = badges[href];
            return (
              <Link
                key={href}
                href={href}
                title={label}
                {...navOnboardingProps(href)}
                className={clsx(
                  "relative flex h-11 items-center rounded-xl transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
                )}

                <span className="relative flex w-[56px] shrink-0 items-center justify-center">
                  <Icon size={20} />
                  {badge ? (
                    <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white group-hover:hidden" />
                  ) : null}
                </span>

                <span className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {label}
                </span>

                {badge ? (
                  <span className="ml-auto mr-3 hidden h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white group-hover:inline-flex">
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <p className="h-12 overflow-hidden whitespace-nowrap px-5 py-4 text-[11px] text-slate-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          SAMA · Bismarchi Pires
        </p>
      </aside>
    </>
  );
}
