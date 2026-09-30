"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Z } from "@/lib/zIndex";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
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

function isoParaBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function brParaIso(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const dt = new Date(ano, mes - 1, dia);
  if (
    dt.getFullYear() !== ano ||
    dt.getMonth() !== mes - 1 ||
    dt.getDate() !== dia
  ) {
    return null;
  }
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function mascaraData(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
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

export function DateBrInput({
  label,
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
}) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState(() => isoParaBr(value));
  const [erroLocal, setErroLocal] = useState<string>();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setTexto(isoParaBr(value));
    setErroLocal(undefined);
  }, [value]);

  function commit(br: string) {
    const iso = brParaIso(br);
    if (!br.trim()) {
      onChange("");
      setErroLocal(undefined);
      return;
    }
    if (!iso) {
      setErroLocal("Use DD/MM/AAAA");
      return;
    }
    setErroLocal(undefined);
    setTexto(isoParaBr(iso));
    onChange(iso);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div ref={wrapRef} className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          value={texto}
          onChange={(e) => {
            const next = mascaraData(e.target.value);
            setTexto(next);
            setErroLocal(undefined);
            const iso = brParaIso(next);
            if (iso) onChange(iso);
          }}
          onBlur={() => commit(texto)}
          className={clsx(
            "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
            (error || erroLocal) &&
              "border-red-400 focus:border-red-500 focus:ring-red-500"
          )}
        />
        <button
          type="button"
          aria-label="Abrir calendário"
          aria-expanded={aberto}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAberto((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <CalendarDays size={16} />
        </button>
      </div>
      {aberto && (
        <CalendarPopover
          ymd={/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ""}
          anchor={wrapRef.current}
          onClose={() => setAberto(false)}
          onPick={(iso) => {
            setTexto(isoParaBr(iso));
            setErroLocal(undefined);
            onChange(iso);
          }}
        />
      )}
      {(error || erroLocal) && (
        <span className="text-xs text-red-600">{error || erroLocal}</span>
      )}
    </div>
  );
}
