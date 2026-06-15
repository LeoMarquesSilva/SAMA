"use client";

import { List, CalendarDays } from "lucide-react";
import { clsx } from "clsx";

export type CalendarioViewMode = "lista" | "calendario";

export function CalendarioViewToggle({
  value,
  onChange,
}: {
  value: CalendarioViewMode;
  onChange: (mode: CalendarioViewMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
      role="tablist"
      aria-label="Modo de visualização"
    >
      <ViewTab
        active={value === "lista"}
        onClick={() => onChange("lista")}
        icon={List}
        label="Lista"
      />
      <ViewTab
        active={value === "calendario"}
        onClick={() => onChange("calendario")}
        icon={CalendarDays}
        label="Calendário"
      />
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof List;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-white text-brand-700 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
