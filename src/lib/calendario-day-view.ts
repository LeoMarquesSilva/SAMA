import type { OutlookEventoComPessoa } from "@/types/database";
import {
  eventsOnDay,
  formatTimeRange,
  isMultiDayEvent,
} from "@/lib/calendario-events";
import {
  dayKeyInTz,
  endOfDayInstantInTz,
  minutesSinceMidnightInTz,
  startOfDayInstantInTz,
  timePartsInTz,
} from "@/lib/timezone";

export const DAY_VIEW_START_HOUR = 6;
export const DAY_VIEW_END_HOUR = 22;
export const DAY_VIEW_HOUR_PX = 52;
export const DAY_VIEW_HOUR_PX_MIN = 36;
export const DAY_VIEW_HOUR_PX_MAX = 96;
export const DAY_VIEW_HOUR_PX_STEP = 8;

export type DayTimedBlock = {
  event: OutlookEventoComPessoa;
  topMin: number;
  heightMin: number;
  continuesFrom: boolean;
  continuesTo: boolean;
};

export type PositionedDayTimedBlock = DayTimedBlock & {
  column: number;
  columnCount: number;
};

function blocksOverlap(a: DayTimedBlock, b: DayTimedBlock): boolean {
  return a.topMin < b.topMin + b.heightMin && b.topMin < a.topMin + a.heightMin;
}

function buildOverlapClusters(blocks: DayTimedBlock[]): DayTimedBlock[][] {
  if (blocks.length === 0) return [];

  const parent = blocks.map((_, i) => i);

  function find(i: number): number {
    let root = i;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]!]!;
      root = parent[root]!;
    }
    return root;
  }

  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocksOverlap(blocks[i]!, blocks[j]!)) union(i, j);
    }
  }

  const map = new Map<number, DayTimedBlock[]>();
  for (let i = 0; i < blocks.length; i++) {
    const root = find(i);
    const list = map.get(root) ?? [];
    list.push(blocks[i]!);
    map.set(root, list);
  }

  return [...map.values()];
}

/** Distribui eventos sobrepostos em colunas (estilo Google Calendar). */
export function layoutTimedBlocks(
  blocks: DayTimedBlock[]
): PositionedDayTimedBlock[] {
  if (blocks.length === 0) return [];

  const result: PositionedDayTimedBlock[] = [];

  for (const cluster of buildOverlapClusters(blocks)) {
    const clusterSorted = [...cluster].sort((a, b) => {
      if (a.topMin !== b.topMin) return a.topMin - b.topMin;
      return b.heightMin - a.heightMin;
    });

    const columns: DayTimedBlock[][] = [];
    const assignments = new Map<DayTimedBlock, number>();

    for (const block of clusterSorted) {
      let col = 0;
      for (; col < columns.length; col++) {
        const conflicts = columns[col]!.some((b) => blocksOverlap(b, block));
        if (!conflicts) break;
      }
      if (col === columns.length) columns.push([]);
      columns[col]!.push(block);
      assignments.set(block, col);
    }

    const columnCount = columns.length;

    for (const block of cluster) {
      result.push({
        ...block,
        column: assignments.get(block) ?? 0,
        columnCount,
      });
    }
  }

  return result.sort(
    (a, b) => a.topMin - b.topMin || a.column - b.column
  );
}

export function clampDayViewHourPx(px: number): number {
  return Math.min(
    DAY_VIEW_HOUR_PX_MAX,
    Math.max(DAY_VIEW_HOUR_PX_MIN, px)
  );
}

function isAllDayEvent(e: OutlookEventoComPessoa): boolean {
  if (isMultiDayEvent(e.inicio, e.fim, e.duracao_minutos)) return true;
  if (e.duracao_minutos && e.duracao_minutos >= 1440) return true;
  if (!e.inicio) return false;

  try {
    if (!e.fim) return false;
    const start = timePartsInTz(e.inicio);
    const end = timePartsInTz(e.fim);
    const startKey = dayKeyInTz(e.inicio);
    const endKey = dayKeyInTz(e.fim);

    if (
      start.hours === 0 &&
      start.minutes === 0 &&
      end.hours === 0 &&
      end.minutes === 0 &&
      endKey > startKey
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function clipEventToDay(
  e: OutlookEventoComPessoa,
  date: Date
): DayTimedBlock | null {
  if (!e.inicio) return null;

  try {
    const targetKey = dayKeyInTz(date);
    const dayStart = startOfDayInstantInTz(targetKey);
    const dayEnd = endOfDayInstantInTz(targetKey);

    let startMs = new Date(e.inicio).getTime();
    let endMs = e.fim
      ? new Date(e.fim).getTime()
      : startMs + (e.duracao_minutos ?? 60) * 60000;

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
    if (endMs <= dayStart || startMs > dayEnd) return null;

    const continuesFrom = startMs < dayStart;
    const continuesTo = endMs > dayEnd;

    startMs = Math.max(startMs, dayStart);
    endMs = Math.min(endMs, dayEnd);

    const topMin = minutesSinceMidnightInTz(new Date(startMs));
    let endMin = minutesSinceMidnightInTz(new Date(endMs));
    if (endMin <= topMin && continuesTo) endMin = topMin + 30;
    if (endMin <= topMin) endMin = topMin + 15;

    return {
      event: e,
      topMin,
      heightMin: endMin - topMin,
      continuesFrom,
      continuesTo,
    };
  } catch {
    return null;
  }
}

export function buildDaySchedule(
  eventos: OutlookEventoComPessoa[],
  date: Date
): { allDay: OutlookEventoComPessoa[]; timed: DayTimedBlock[] } {
  const covering = eventsOnDay(eventos, date);
  const allDay: OutlookEventoComPessoa[] = [];
  const timed: DayTimedBlock[] = [];

  for (const e of covering) {
    if (isAllDayEvent(e)) {
      allDay.push(e);
    } else {
      const block = clipEventToDay(e, date);
      if (block) timed.push(block);
    }
  }

  allDay.sort(
    (a, b) =>
      new Date(a.inicio ?? 0).getTime() - new Date(b.inicio ?? 0).getTime()
  );
  timed.sort((a, b) => a.topMin - b.topMin);

  return { allDay, timed };
}

export function formatTimedBlockRange(block: DayTimedBlock): string {
  return formatTimeRange(
    block.event.inicio,
    block.event.fim,
    block.event.duracao_minutos
  );
}

export function computeDayViewHours(timed: DayTimedBlock[]): number[] {
  let minH = DAY_VIEW_START_HOUR;
  let maxH = DAY_VIEW_END_HOUR;

  for (const b of timed) {
    const startH = Math.floor(b.topMin / 60);
    const endH = Math.ceil((b.topMin + b.heightMin) / 60);
    minH = Math.min(minH, Math.max(0, startH - 1));
    maxH = Math.max(maxH, Math.min(24, endH + 1));
  }

  const hours: number[] = [];
  for (let h = minH; h <= maxH; h++) hours.push(h);
  return hours;
}

export function minutesToTopPx(
  minutes: number,
  startHour: number,
  hourPx: number
): number {
  return ((minutes - startHour * 60) / 60) * hourPx;
}

export function minutesToHeightPx(
  minutes: number,
  hourPx: number,
  minPx = 28
): number {
  return Math.max((minutes / 60) * hourPx, minPx);
}
