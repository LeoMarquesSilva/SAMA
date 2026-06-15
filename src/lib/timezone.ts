/** Fuso horário oficial do app (calendário Outlook / sócios no Brasil). */
export const APP_TIMEZONE = "America/Sao_Paulo";

/** yyyy-MM-dd no fuso de São Paulo. */
export function dayKeyInTz(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

export function timePartsInTz(instant: Date | string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  return {
    hours: Number(parts.find((p) => p.type === "hour")!.value),
    minutes: Number(parts.find((p) => p.type === "minute")!.value),
    seconds: Number(parts.find((p) => p.type === "second")!.value),
  };
}

export function formatTimeInTz(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function todayKeyInTz(): string {
  return dayKeyInTz(new Date());
}

export function todayDayNumberInTz(): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
  }).formatToParts(new Date());
  return parts.find((p) => p.type === "day")!.value;
}

export function isTodayInTz(date: Date): boolean {
  return dayKeyInTz(date) === todayKeyInTz();
}

export function isSameDayInTz(a: Date, b: Date): boolean {
  return dayKeyInTz(a) === dayKeyInTz(b);
}

/** Instante UTC da meia-noite civil em São Paulo (00:00 SP). */
export function startOfDayInstantInTz(dayKeyOrDate: string | Date): number {
  const key =
    typeof dayKeyOrDate === "string" ? dayKeyOrDate : dayKeyInTz(dayKeyOrDate);
  return Date.parse(`${key}T03:00:00.000Z`);
}

export function endOfDayInstantInTz(dayKeyOrDate: string | Date): number {
  const key =
    typeof dayKeyOrDate === "string" ? dayKeyOrDate : dayKeyInTz(dayKeyOrDate);
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return startOfDayInstantInTz(nextKey) - 1;
}

export function dateFromDayKey(dayKey: string): Date {
  return new Date(startOfDayInstantInTz(dayKey) + 12 * 60 * 60 * 1000);
}

export function todayDateInTz(): Date {
  return dateFromDayKey(todayKeyInTz());
}

/** yyyy-MM-dd a partir de timestamp UTC (ms). */
export function dayKeyFromMs(ms: number): string {
  return dayKeyInTz(new Date(ms));
}

export function nextDayKey(dayKey: string): string {
  return dayKeyFromMs(startOfDayInstantInTz(dayKey) + 36 * 60 * 60 * 1000);
}

export function eachDayKeyInRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cur = startKey;
  while (cur <= endKey) {
    keys.push(cur);
    cur = nextDayKey(cur);
  }
  return keys;
}

export function minutesSinceMidnightInTz(instant: Date | string): number {
  const { hours, minutes } = timePartsInTz(instant);
  return hours * 60 + minutes;
}

/** 0 = domingo … 6 = sábado (São Paulo). */
export function dayOfWeekInTz(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

export function addDaysInTz(date: Date, days: number): Date {
  const key = dayKeyInTz(date);
  return dateFromDayKey(
    dayKeyFromMs(startOfDayInstantInTz(key) + days * 86400000)
  );
}

export function weekDayKeysContaining(date: Date): string[] {
  const key = dayKeyInTz(date);
  const dow = dayOfWeekInTz(dateFromDayKey(key));
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    keys.push(
      dayKeyFromMs(startOfDayInstantInTz(key) + (i - dow) * 86400000)
    );
  }
  return keys;
}

export function daysInMonthGrid(cursorDate: Date): Date[] {
  const anchor = dayKeyInTz(cursorDate);
  const [y, mo] = anchor.split("-").map(Number);
  const firstKey = `${y}-${String(mo).padStart(2, "0")}-01`;
  const nextMonthKey =
    mo === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  const lastKey = dayKeyFromMs(startOfDayInstantInTz(nextMonthKey) - 86400000);

  const startDow = dayOfWeekInTz(dateFromDayKey(firstKey));
  const gridStartKey = dayKeyFromMs(
    startOfDayInstantInTz(firstKey) - startDow * 86400000
  );
  const endDow = dayOfWeekInTz(dateFromDayKey(lastKey));
  const gridEndKey = dayKeyFromMs(
    startOfDayInstantInTz(lastKey) + (6 - endDow) * 86400000
  );

  return eachDayKeyInRange(gridStartKey, gridEndKey).map(dateFromDayKey);
}

export function formatDayMonthInTz(dayKey: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
  }).format(dateFromDayKey(dayKey));
}

export function formatDayInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
  }).format(date);
}

export function addMonthsInTz(date: Date, months: number): Date {
  const [y, m, d] = dayKeyInTz(date).split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = Number(
    dayKeyFromMs(
      startOfDayInstantInTz(
        nm === 12 ? `${ny + 1}-01-01` : `${ny}-${String(nm + 1).padStart(2, "0")}-01`
      ) - 86400000
    ).split("-")[2]
  );
  const nd = Math.min(d, lastDay);
  return dateFromDayKey(
    `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`
  );
}

export function formatMonthYearInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekdayShortInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}

export function formatMonthShortInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

export function formatWeekdayLongInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatWeekRangeEndInTz(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Converte ISO UTC → datetime-local no fuso SP. */
export function toDatetimeLocalInTz(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const { hours, minutes } = timePartsInTz(iso);
    const key = dayKeyInTz(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${key}T${pad(hours)}:${pad(minutes)}`;
  } catch {
    return "";
  }
}
