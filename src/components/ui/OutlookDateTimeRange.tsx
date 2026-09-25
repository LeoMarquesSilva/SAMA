"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { clsx } from "clsx";
import { Z } from "@/lib/zIndex";
import { diffMinutos } from "@/lib/format";
import { OutlookDisponibilidade } from "@/components/ui/OutlookDisponibilidade";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { salaOptions, type SalaReuniao } from "@/lib/salas";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const WEEKDAYS_LONG = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

const DURACOES = [15, 30, 45, 60, 90, 120, 180, 240];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitLocal(local: string): { ymd: string; hm: string } {
  const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return { ymd: "", hm: "09:00" };
  return { ymd: m[1], hm: m[2] };
}

function joinLocal(ymd: string, hm: string) {
  return `${ymd}T${hm}`;
}

function addMinutes(local: string, minutes: number): string {
  const { ymd, hm } = splitLocal(local);
  if (!ymd) return local;
  const [h, mi] = hm.split(":").map(Number);
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi);
  dt.setMinutes(dt.getMinutes() + minutes);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function proximoSlotLocal(now = new Date(), duracao = 30): {
  inicio: string;
  fim: string;
} {
  const dt = new Date(now);
  const extra = dt.getMinutes() % 30 === 0 && dt.getSeconds() === 0 ? 0 : 30 - (dt.getMinutes() % 30);
  dt.setMinutes(dt.getMinutes() + extra, 0, 0);
  const inicio = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return { inicio, fim: addMinutes(inicio, duracao) };
}

function labelData(ymd: string): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!y || !mo || !d) return "Escolher data";
  const dt = new Date(y, mo - 1, d);
  return `${WEEKDAYS_LONG[dt.getDay()]} ${pad(d)} de ${MONTHS[dt.getMonth()]} de ${y}`;
}

function timeSlots(step = 15): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

function labelDuracao(min: number): string {
  if (min < 60) return `${min} minutos`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!m) return h === 1 ? "1 hora" : `${h} horas`;
  return `${h} h ${m} min`;
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: startPad }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function CalendarPopover({
  ymd,
  onPick,
  onClose,
  anchor,
}: {
  ymd: string;
  onPick: (ymd: string) => void;
  onClose: () => void;
  anchor: HTMLElement | null;
}) {
  const [y, mo] = ymd
    ? ymd.split("-").map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [cursor, setCursor] = useState({ year: y, month: mo - 1 });
  const panelRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [anchor, onClose]);

  const rect = anchor?.getBoundingClientRect();
  const style = rect
    ? {
        position: "fixed" as const,
        top: Math.min(rect.bottom + 6, window.innerHeight - 360),
        left: Math.min(rect.left, window.innerWidth - 300),
        zIndex: Z.popover,
      }
    : undefined;

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          onClick={() =>
            setCursor((c) =>
              c.month === 0
                ? { year: c.year - 1, month: 11 }
                : { year: c.year, month: c.month - 1 }
            )
          }
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold capitalize text-slate-800">
          {MONTHS[cursor.month]} {cursor.year}
        </p>
        <button
          type="button"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          onClick={() =>
            setCursor((c) =>
              c.month === 11
                ? { year: c.year + 1, month: 0 }
                : { year: c.year, month: c.month + 1 }
            )
          }
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAYS.map((w, i) => (
          <span key={`${w}-${i}`}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthCells(cursor.year, cursor.month).map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const key = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
          const selected = key === ymd;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onPick(key);
                onClose();
              }}
              className={clsx(
                "h-8 rounded-lg text-sm",
                selected && "bg-brand-600 font-semibold text-white",
                !selected && isToday && "font-semibold text-brand-700 ring-1 ring-brand-300",
                !selected && !isToday && "text-slate-700 hover:bg-slate-100"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

function TimePopover({
  value,
  onPick,
  onClose,
  anchor,
}: {
  value: string;
  onPick: (hm: string) => void;
  onClose: () => void;
  anchor: HTMLElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const slots = useMemo(() => timeSlots(15), []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [anchor, onClose]);

  const rect = anchor?.getBoundingClientRect();
  const style = rect
    ? {
        position: "fixed" as const,
        top: Math.min(rect.bottom + 6, window.innerHeight - 280),
        left: rect.left,
        zIndex: Z.popover,
      }
    : undefined;

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className="max-h-64 w-28 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
    >
      {slots.map((hm) => (
        <button
          key={hm}
          type="button"
          ref={hm === value ? activeRef : undefined}
          onClick={() => {
            onPick(hm);
            onClose();
          }}
          className={clsx(
            "flex w-full px-3 py-1.5 text-left text-sm tabular-nums",
            hm === value
              ? "bg-brand-50 font-semibold text-brand-700"
              : "text-slate-700 hover:bg-slate-50"
          )}
        >
          {hm}
        </button>
      ))}
    </div>,
    document.body
  );
}

function DateField({
  ymd,
  onChange,
  error,
}: {
  ymd: string;
  onChange: (ymd: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm hover:border-brand-400",
          error ? "border-red-400" : "border-slate-300"
        )}
      >
        <CalendarDays size={16} className="shrink-0 text-slate-400" />
        <span className="truncate">{labelData(ymd)}</span>
      </button>
      {open && (
        <CalendarPopover
          ymd={ymd}
          anchor={btnRef.current}
          onPick={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TimeField({
  hm,
  onChange,
  error,
}: {
  hm: string;
  onChange: (hm: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex w-[6.5rem] shrink-0 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm tabular-nums text-slate-800 shadow-sm hover:border-brand-400",
          error ? "border-red-400" : "border-slate-300"
        )}
      >
        <Clock size={16} className="shrink-0 text-slate-400" />
        {hm}
      </button>
      {open && (
        <TimePopover
          value={hm}
          anchor={btnRef.current}
          onPick={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function OutlookDateTimeRange({
  inicio,
  fim,
  onChange,
  errorInicio,
  errorFim,
  errorDuracao,
  sala,
  onSalaChange,
}: {
  inicio: string;
  fim: string;
  onChange: (next: { inicio: string; fim: string; duracao: number }) => void;
  errorInicio?: string;
  errorFim?: string;
  errorDuracao?: string;
  sala?: string;
  onSalaChange?: (sala: SalaReuniao) => void;
}) {
  const formId = useId();
  const duracao = diffMinutos(inicio, fim) ?? 30;
  const start = splitLocal(inicio);
  const end = splitLocal(fim);

  function emit(nextInicio: string, nextFim: string) {
    const mins = diffMinutos(nextInicio, nextFim) ?? 30;
    onChange({ inicio: nextInicio, fim: nextFim, duracao: mins });
  }

  function setStart(ymd: string, hm: string) {
    const nextInicio = joinLocal(ymd, hm);
    emit(nextInicio, addMinutes(nextInicio, duracao));
  }

  function setEnd(ymd: string, hm: string) {
    const nextFim = joinLocal(ymd, hm);
    const mins = diffMinutos(inicio, nextFim);
    if (mins == null || mins <= 0) {
      emit(inicio, addMinutes(inicio, 30));
      return;
    }
    emit(inicio, nextFim);
  }

  function setDuracao(mins: number) {
    emit(inicio, addMinutes(inicio, mins));
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <input type="hidden" name="data_hora_inicio" id={`${formId}-inicio`} value={inicio} />
      <input type="hidden" name="data_hora_fim" id={`${formId}-fim`} value={fim} />
      <input type="hidden" name="duracao_minutos" value={duracao} />

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Quando
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <DateField
          ymd={start.ymd}
          onChange={(ymd) => setStart(ymd, start.hm)}
          error={Boolean(errorInicio)}
        />
        <TimeField
          hm={start.hm}
          onChange={(hm) => setStart(start.ymd, hm)}
          error={Boolean(errorInicio)}
        />
        <span className="text-sm text-slate-400">até</span>
        {start.ymd !== end.ymd && (
          <DateField
            ymd={end.ymd}
            onChange={(ymd) => setEnd(ymd, end.hm)}
            error={Boolean(errorFim)}
          />
        )}
        <TimeField
          hm={end.hm}
          onChange={(hm) => setEnd(end.ymd, hm)}
          error={Boolean(errorFim)}
        />
        <select
          value={DURACOES.includes(duracao) ? String(duracao) : "custom"}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v) setDuracao(v);
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 shadow-sm"
          aria-label="Duração"
        >
          {DURACOES.map((m) => (
            <option key={m} value={m}>
              {labelDuracao(m)}
            </option>
          ))}
          {!DURACOES.includes(duracao) && (
            <option value="custom">{labelDuracao(duracao)}</option>
          )}
        </select>
      </div>
      <p className="text-[11px] text-slate-400">Fuso: Brasília (GMT-3)</p>
      {(errorInicio || errorFim || errorDuracao) && (
        <p className="text-xs text-red-600">
          {errorInicio || errorFim || errorDuracao}
        </p>
      )}

      {onSalaChange && (
        <SelectMenu
          name="sala"
          label="Sala"
          value={sala ?? ""}
          onChange={(v) => onSalaChange(v as SalaReuniao)}
          options={salaOptions()}
        />
      )}

      {sala !== undefined && (
        <OutlookDisponibilidade
          sala={sala}
          inicio={inicio}
          fim={fim}
          onPick={(i, f) => emit(i, f)}
        />
      )}
    </div>
  );
}
