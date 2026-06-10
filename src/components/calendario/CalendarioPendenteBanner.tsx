import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { CALENDARIO_PATH } from "@/lib/calendario";

export function CalendarioPendenteBanner({ pendentes }: { pendentes: number }) {
  if (!pendentes) return null;

  return (
    <Link
      href={CALENDARIO_PATH}
      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition hover:bg-amber-100"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
        <CalendarClock size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <strong>{pendentes}</strong> evento(s) do calendário aguardando
        categorização.
      </span>
      <span className="shrink-0 font-medium underline">Categorizar →</span>
    </Link>
  );
}
