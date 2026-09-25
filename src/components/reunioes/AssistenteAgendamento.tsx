"use client";

import { useState, useTransition } from "react";
import { consultarAgendaLivre } from "@/lib/reunioes/outlook-write";
import { isSalaPresencial } from "@/lib/salas";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { clsx } from "clsx";

function startOfDayIso(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function endOfDayIso(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}

function slotLabel(day: Date, index: number, interval: 15 | 30) {
  const mins = index * interval;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function AssistenteAgendamento({
  emailsInternos,
  sala,
  dataBase,
  onPick,
}: {
  emailsInternos: string[];
  sala?: string | null;
  dataBase: string;
  onPick: (inicioLocal: string, fimLocal: string) => void;
}) {
  const [interval, setInterval] = useState<15 | 30>(30);
  const [error, setError] = useState<string>();
  const [views, setViews] = useState<{ email: string; view: string }[]>([]);
  const [salaIncluida, setSalaIncluida] = useState<boolean | null>(null);
  const [pending, start] = useTransition();

  function consultar() {
    setError(undefined);
    const day = dataBase ? new Date(dataBase) : new Date();
    const emails = [...emailsInternos];
    if (typeof window === "undefined") {
      /* room mailbox só no server — cliente consulta só internos */
    }
    start(async () => {
      const r = await consultarAgendaLivre({
        emails,
        startISO: startOfDayIso(day),
        endISO: endOfDayIso(day),
        intervalMinutes: interval,
        sala,
      });
      if (!r.ok) {
        setError(r.error ?? "Não foi possível consultar agendas.");
        setSalaIncluida(false);
        return;
      }
      setSalaIncluida(Boolean(r.salaIncluida));
      setViews(
        (r.slots ?? []).map((s) => ({ email: s.email, view: s.availabilityView }))
      );
    });
  }

  const len = views[0]?.view.length ?? 0;
  const day = dataBase ? new Date(dataBase) : new Date();
  const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Assistente de agendamento
        </p>
        <SelectMenu
          value={String(interval)}
          onChange={(v) => setInterval(v === "15" ? 15 : 30)}
          options={[
            { value: "15", label: "15 min" },
            { value: "30", label: "30 min" },
          ]}
        />
        <Button type="button" variant="secondary" size="sm" onClick={consultar} disabled={pending}>
          Ver livre/ocupado
        </Button>
      </div>
      {isSalaPresencial(sala) && salaIncluida === false && (
        <p className="text-xs text-amber-700">
          Não achei a mailbox desta sala no Graph — o conflito da sala não
          entra na grade.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {len > 0 && (
        <div className="overflow-x-auto">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `repeat(${Math.min(len, 32)}, minmax(2.2rem,1fr))` }}
          >
            {Array.from({ length: Math.min(len, 32) }, (_, i) => {
              const occupied = views.some((v) => {
                const ch = v.view[i];
                return ch && ch !== "0";
              });
              const label = slotLabel(day, i, interval);
              return (
                <button
                  key={i}
                  type="button"
                  title={label}
                  className={clsx(
                    "h-8 rounded text-[10px]",
                    occupied
                      ? "bg-rose-200 text-rose-800"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  )}
                  onClick={() => {
                    if (occupied) return;
                    const start = `${ymd}T${label}`;
                    const endMins = (i + 1) * interval;
                    const eh = Math.floor(endMins / 60);
                    const em = endMins % 60;
                    const end = `${ymd}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
                    onPick(start, end);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Verde = todos livres. Clique para preencher o horário.
          </p>
        </div>
      )}
    </div>
  );
}
