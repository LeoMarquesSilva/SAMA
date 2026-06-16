import {
  dayKeyFromMs,
  dayKeyInTz,
  dateFromDayKey,
  eachDayKeyInRange,
  endOfDayInstantInTz,
  formatDayMonthInTz,
  formatTimeInTz,
  startOfDayInstantInTz,
  timePartsInTz,
} from "@/lib/timezone";
import type { CalendarioItemKind } from "@/lib/calendario-items";
import type { OutlookEventoComPessoa, OutlookEventoStatus } from "@/types/database";

/** Chave yyyy-MM-dd (São Paulo) para agrupamento. */
export function dayKey(date: Date): string {
  return dayKeyInTz(date);
}

export function eventDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return dayKeyInTz(iso);
  } catch {
    return null;
  }
}

/**
 * Dias civis (SP, inclusivos) em que o evento ocorre.
 * Outlook usa fim exclusivo à meia-noite em eventos de dia inteiro.
 */
export function eventSpanDayKeys(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  duracaoMinutos?: number | null
): string[] {
  if (!inicio) return [];
  try {
    const startKey = dayKeyInTz(inicio);
    let endKey = startKey;

    if (fim) {
      endKey = dayKeyInTz(fim);
      const endParts = timePartsInTz(fim);

      // Fim à meia-noite em dia posterior = exclusivo (all-day Outlook)
      if (endKey > startKey && endParts.hours === 0 && endParts.minutes === 0 && endParts.seconds === 0) {
        endKey = dayKeyFromMs(startOfDayInstantInTz(endKey) - 1);
      }
    } else if (duracaoMinutos && duracaoMinutos > 0) {
      endKey = dayKeyInTz(new Date(new Date(inicio).getTime() + duracaoMinutos * 60000));
    }

    if (endKey < startKey) endKey = startKey;
    return eachDayKeyInRange(startKey, endKey);
  } catch {
    return [];
  }
}

export function eventSpanDays(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  duracaoMinutos?: number | null
): Date[] {
  return eventSpanDayKeys(inicio, fim, duracaoMinutos).map((k) =>
    new Date(startOfDayInstantInTz(k) + 12 * 60 * 60 * 1000)
  );
}

export function eventCoversDay(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  date: Date,
  duracaoMinutos?: number | null
): boolean {
  const target = dayKeyInTz(date);
  return eventSpanDayKeys(inicio, fim, duracaoMinutos).includes(target);
}

export function isMultiDayEvent(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  duracaoMinutos?: number | null
): boolean {
  return eventSpanDayKeys(inicio, fim, duracaoMinutos).length > 1;
}

/** Agrupa apenas eventos de um dia (multi-dia ficam nas barras contínuas). */
export function groupSingleDayEventsByDay<T extends { inicio: string | null; fim: string | null; duracao_minutos: number | null }>(
  eventos: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of eventos) {
    if (isMultiDayEvent(e.inicio, e.fim, e.duracao_minutos)) continue;
    const key = eventDayKey(e.inicio);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
      const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
      return ta - tb;
    });
  }
  return map;
}

export function groupEventsByDay(
  eventos: OutlookEventoComPessoa[]
): Map<string, OutlookEventoComPessoa[]> {
  return groupSingleDayEventsByDay(eventos);
}

export function eventsOnDay<T extends { inicio: string | null; fim: string | null; duracao_minutos: number | null }>(
  eventos: T[],
  date: Date
): T[] {
  return eventos
    .filter((e) =>
      eventCoversDay(e.inicio, e.fim, date, e.duracao_minutos)
    )
    .sort((a, b) => {
      const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
      const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
      return ta - tb;
    });
}

export function daysWithEvents(
  eventos: OutlookEventoComPessoa[]
): Date[] {
  const keys = new Set<string>();
  for (const e of eventos) {
    for (const k of eventSpanDayKeys(e.inicio, e.fim, e.duracao_minutos)) {
      keys.add(k);
    }
  }
  return [...keys]
    .sort()
    .map((k) => new Date(startOfDayInstantInTz(k) + 12 * 60 * 60 * 1000));
}

export const atividadeCalendarColor = {
  dot: "bg-violet-500",
  chipBg: "bg-violet-500",
  chipText: "text-white",
  timeBadge: "bg-white text-black ring-1 ring-black/15 shadow-sm",
};

export const statusCalendarColor: Record<
  OutlookEventoStatus,
  { dot: string; chipBg: string; chipText: string; timeBadge: string }
> = {
  PENDENTE: {
    dot: "bg-amber-500",
    chipBg: "bg-amber-400",
    chipText: "text-amber-950",
    timeBadge: "bg-white text-black ring-1 ring-black/15 shadow-sm",
  },
  CATEGORIZADO_REUNIAO: {
    dot: "bg-emerald-600",
    chipBg: "bg-emerald-500",
    chipText: "text-white",
    timeBadge: "bg-white text-black ring-1 ring-black/15 shadow-sm",
  },
  CATEGORIZADO_ATIVIDADE: {
    dot: "bg-brand-500",
    chipBg: "bg-brand-500",
    chipText: "text-white",
    timeBadge: "bg-white text-black ring-1 ring-black/15 shadow-sm",
  },
  IGNORADO: {
    dot: "bg-slate-400",
    chipBg: "bg-slate-300",
    chipText: "text-slate-700",
    timeBadge: "bg-white text-black ring-1 ring-black/15 shadow-sm",
  },
};

export type CalendarioColor = (typeof statusCalendarColor)[OutlookEventoStatus];

export function calendarioItemColor(item: {
  status: OutlookEventoStatus;
  itemKind?: CalendarioItemKind;
}): CalendarioColor {
  if (item.itemKind === "atividade") return atividadeCalendarColor;
  return statusCalendarColor[item.status];
}

export function formatTimeShort(iso: string | null | undefined): string {
  return formatTimeInTz(iso);
}

export function formatTimeRange(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  duracaoMinutos?: number | null
): string {
  const start = formatTimeShort(inicio);
  if (!start) return "";

  let end = formatTimeShort(fim);
  if (!end && inicio && duracaoMinutos && duracaoMinutos > 0) {
    end = formatTimeInTz(
      new Date(new Date(inicio).getTime() + duracaoMinutos * 60000).toISOString()
    );
  }

  if (!end || end === start) return start;
  return `${start}–${end}`;
}

export function formatMultiDayDuration(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  duracaoMinutos?: number | null
): string {
  const keys = eventSpanDayKeys(inicio, fim, duracaoMinutos);
  const n = keys.length;
  if (n <= 1) return "";

  const countLabel = n === 1 ? "1 dia" : `${n} dias`;
  const startLabel = formatDayMonthInTz(keys[0]);
  const endLabel = formatDayMonthInTz(keys[keys.length - 1]);
  const sameMonth = keys[0].slice(0, 7) === keys[keys.length - 1].slice(0, 7);

  const rangeLabel = sameMonth
    ? `${Number(keys[0].split("-")[2])}–${endLabel}`
    : `${startLabel} – ${endLabel}`;

  return `${countLabel} · ${rangeLabel}`;
}

// Re-export para componentes
export { isSameDayInTz, isTodayInTz } from "@/lib/timezone";
