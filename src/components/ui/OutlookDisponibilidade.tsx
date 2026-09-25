"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { consultarAgendaLivre } from "@/lib/reunioes/outlook-write";
import { isSalaPresencial, SALA_LABEL, type SalaReuniao } from "@/lib/salas";

const INICIO_MIN = 8 * 60;
const FIM_MIN = 19 * 60;
const INTERVALO = 15 as const;
const HORAS = Array.from(
  { length: (FIM_MIN - INICIO_MIN) / 60 },
  (_, i) => 8 + i
);

function splitLocal(local: string): { ymd: string; hm: string } {
  const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return { ymd: "", hm: "09:00" };
  return { ymd: m[1], hm: m[2] };
}

function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minToHm(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function startOfDayIso(ymd: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d, 0, 0, 0, 0).toISOString();
}

function endOfDayIso(ymd: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d, 23, 59, 59, 999).toISOString();
}

function slotOcupado(view: string, startHm: string, endHm: string) {
  const a = Math.floor(hmToMin(startHm) / INTERVALO);
  const b = Math.max(a + 1, Math.floor(hmToMin(endHm) / INTERVALO));
  for (let i = a; i < b && i < view.length; i++) {
    if (view[i] && view[i] !== "0") return true;
  }
  return false;
}

export function OutlookDisponibilidade({
  sala,
  inicio,
  fim,
  onPick,
}: {
  sala?: string | null;
  inicio: string;
  fim: string;
  onPick: (inicio: string, fim: string) => void;
}) {
  const { ymd, hm: startHm } = splitLocal(inicio);
  const { hm: endHm } = splitLocal(fim);
  const [view, setView] = useState("");
  const [salaIncluida, setSalaIncluida] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!ymd || !isSalaPresencial(sala)) {
      setView("");
      setSalaIncluida(null);
      setError(undefined);
      return;
    }
    const t = window.setTimeout(() => {
      start(async () => {
        const r = await consultarAgendaLivre({
          emails: [],
          startISO: startOfDayIso(ymd),
          endISO: endOfDayIso(ymd),
          intervalMinutes: INTERVALO,
          sala,
        });
        if (!r.ok) {
          setError(r.error);
          setView("");
          setSalaIncluida(false);
          return;
        }
        setView(r.slots?.[0]?.availabilityView ?? "");
        setSalaIncluida(Boolean(r.salaIncluida));
        setError(undefined);
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [ymd, sala]);

  const slots = useMemo(() => {
    const out: { min: number; ocupado: boolean }[] = [];
    for (let min = INICIO_MIN; min < FIM_MIN; min += INTERVALO) {
      const idx = Math.floor(min / INTERVALO);
      const ch = view[idx];
      out.push({ min, ocupado: Boolean(ch && ch !== "0") });
    }
    return out;
  }, [view]);

  if (!isSalaPresencial(sala)) return null;

  const label = SALA_LABEL[(sala ?? "") as SalaReuniao] || sala || "Sala";
  const conflito = view ? slotOcupado(view, startHm, endHm) : null;
  const selA = hmToMin(startHm);
  const selB = hmToMin(endHm);
  const totalMin = FIM_MIN - INICIO_MIN;

  return (
    <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {pending ? (
          <span className="text-[11px] text-slate-400">Atualizando…</span>
        ) : conflito === true ? (
          <span className="text-[11px] font-medium text-rose-700">
            Conflito {startHm}–{endHm}
          </span>
        ) : conflito === false && salaIncluida ? (
          <span className="text-[11px] font-medium text-emerald-700">
            Livre {startHm}–{endHm}
          </span>
        ) : salaIncluida === false ? (
          <span className="text-[11px] text-amber-700">Caixa da sala não encontrada</span>
        ) : null}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {view && (
        <div>
          <div
            className="mb-1 grid text-[10px] tabular-nums text-slate-400"
            style={{ gridTemplateColumns: `repeat(${HORAS.length}, minmax(0, 1fr))` }}
          >
            {HORAS.map((h) => (
              <span key={h}>{String(h).padStart(2, "0")}</span>
            ))}
          </div>

          <div className="relative h-7 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
            <div className="absolute inset-0 flex">
              {HORAS.map((h) => (
                <span
                  key={h}
                  className="flex-1 border-l border-slate-100 first:border-l-0"
                />
              ))}
            </div>

            {slots.map((s) => {
              if (!s.ocupado) return null;
              const left = ((s.min - INICIO_MIN) / totalMin) * 100;
              const width = (INTERVALO / totalMin) * 100;
              return (
                <span
                  key={s.min}
                  className="absolute top-1 bottom-1 rounded-sm bg-rose-300/90"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}

            {selB > selA && (
              <span
                className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-sm bg-brand-500/35 ring-1 ring-inset ring-brand-600"
                style={{
                  left: `${Math.max(0, ((selA - INICIO_MIN) / totalMin) * 100)}%`,
                  width: `${Math.min(100, ((selB - selA) / totalMin) * 100)}%`,
                }}
              />
            )}

            <div className="absolute inset-0 flex">
              {slots.map((s) => (
                <button
                  key={s.min}
                  type="button"
                  title={minToHm(s.min)}
                  disabled={s.ocupado}
                  onClick={() => {
                    const dur = Math.max(selB - selA, 30);
                    onPick(
                      `${ymd}T${minToHm(s.min)}`,
                      `${ymd}T${minToHm(s.min + dur)}`
                    );
                  }}
                  className="flex-1"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
