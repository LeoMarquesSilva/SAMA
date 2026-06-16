"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Building2,
  Plus,
  CalendarDays,
  ClipboardList,
  Clock,
  UserPlus,
  X,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/timesheet", label: "Horas", icon: Clock },
];

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Bottom sheet de captura rápida */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                Captura rápida
              </h2>
              <button
                onClick={() => setSheetOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                icon={CalendarDays}
                label="Registrar reunião"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/calendario");
                }}
              />
              <QuickAction
                icon={ClipboardList}
                label="Registrar atividade"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/calendario");
                }}
              />
              <QuickAction
                icon={UserPlus}
                label="Novo usuário"
                disabled={!isAdmin}
                onClick={() => {
                  if (!isAdmin) return;
                  setSheetOpen(false);
                  router.push("/pessoas?novo=1");
                }}
              />
              <QuickAction
                icon={Building2}
                label="Buscar cliente"
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/clientes");
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        <TabLink {...tabs[0]} active={isActive(pathname, tabs[0].href)} />
        <TabLink {...tabs[1]} active={isActive(pathname, tabs[1].href)} />

        <button
          onClick={() => setSheetOpen(true)}
          className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95"
          aria-label="Captura rápida"
        >
          <Plus size={26} />
        </button>

        <TabLink {...tabs[2]} active={isActive(pathname, tabs[2].href)} />
      </nav>
    </>
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
  hiddenOnRender,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  hiddenOnRender?: boolean;
}) {
  if (hiddenOnRender) return <span className="flex-1" aria-hidden />;
  return (
    <Link
      href={href}
      className={clsx(
        "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
        active ? "text-brand-600" : "text-slate-400"
      )}
    >
      <Icon size={22} />
      {label}
    </Link>
  );
}

function QuickAction({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition",
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 active:scale-[0.98]"
      )}
    >
      <Icon size={22} />
      <span className="text-sm font-medium leading-tight">{label}</span>
      {hint && <span className="text-[11px] uppercase">{hint}</span>}
    </button>
  );
}
