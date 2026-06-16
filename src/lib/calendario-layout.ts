import type { CalendarioItem } from "@/lib/calendario-items";
import {
  dayKey,
  eventSpanDays,
  isMultiDayEvent,
} from "@/lib/calendario-events";

export type MultiDayPlacement = {
  event: CalendarioItem;
  startCol: number;
  span: number;
  lane: number;
  continuesFrom: boolean;
  continuesTo: boolean;
};

/** Divide lista de dias em semanas de 7 colunas. */
export function splitIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** Posiciona barras multi-dia numa semana (estilo Google Calendar). */
export function computeMultiDayPlacements(
  weekDays: Date[],
  eventos: CalendarioItem[]
): MultiDayPlacement[] {
  type Candidate = Omit<MultiDayPlacement, "lane">;
  const candidates: Candidate[] = [];

  for (const e of eventos) {
    if (!isMultiDayEvent(e.inicio, e.fim, e.duracao_minutos)) continue;

    const spanDays = eventSpanDays(e.inicio, e.fim, e.duracao_minutos);
    const spanKeys = new Set(spanDays.map(dayKey));

    let startCol = -1;
    let endCol = -1;
    weekDays.forEach((day, i) => {
      if (spanKeys.has(dayKey(day))) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    });

    if (startCol === -1 || endCol === -1) continue;

    candidates.push({
      event: e,
      startCol: startCol + 1,
      span: endCol - startCol + 1,
      continuesFrom: dayKey(spanDays[0]) !== dayKey(weekDays[startCol]),
      continuesTo:
        dayKey(spanDays[spanDays.length - 1]) !== dayKey(weekDays[endCol]),
    });
  }

  candidates.sort(
    (a, b) => a.startCol - b.startCol || b.span - a.span
  );

  const placements: MultiDayPlacement[] = [];
  const lanes: { startCol: number; endCol: number }[][] = [];

  for (const c of candidates) {
    const end = c.startCol + c.span - 1;
    let lane = 0;

    while (true) {
      if (!lanes[lane]) lanes[lane] = [];
      const conflict = lanes[lane].some(
        (r) => !(end < r.startCol || c.startCol > r.endCol)
      );
      if (!conflict) {
        lanes[lane].push({ startCol: c.startCol, endCol: end });
        placements.push({ ...c, lane });
        break;
      }
      lane++;
    }
  }

  return placements;
}

export function countMultiDayLanes(
  placements: MultiDayPlacement[]
): number {
  if (placements.length === 0) return 0;
  return Math.max(...placements.map((p) => p.lane)) + 1;
}

/** Altura de cada faixa de evento multi-dia dentro da célula (px). */
export const MULTI_DAY_LANE_H = 36;
/** Altura do cabeçalho com número do dia (px). */
export const DAY_NUMBER_H = 28;
