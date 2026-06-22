import { dayKeyInTz, timePartsInTz } from "@/lib/timezone";

/** Offset fixo de São Paulo (sem horário de verão desde 2019). */
export const SP_UTC_OFFSET = "-03:00";

/** yyyy-MM-ddTHH:mm → DD/MM/AAAA HH:mm */
export function formatDatetimeLocalBr(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return local;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** DD/MM/AAAA HH:mm → yyyy-MM-ddTHH:mm (horário de São Paulo) ou null se inválido. */
export function parseDatetimeLocalBr(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;

  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const h = m[4] != null ? Number(m[4]) : 0;
  const min = m[5] != null ? Number(m[5]) : 0;

  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || min > 59) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(min)}`;
  const parsed = new Date(`${local}${SP_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return null;

  return local;
}

/** Aceita ISO, yyyy-MM-ddTHH:mm ou DD/MM/AAAA HH:mm → yyyy-MM-ddTHH:mm. */
export function normalizeDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const br = parseDatetimeLocalBr(trimmed);
  if (br) return br;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 16);
  }

  try {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    const { hours, minutes } = timePartsInTz(d);
    const key = dayKeyInTz(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${key}T${pad(hours)}:${pad(minutes)}`;
  } catch {
    return null;
  }
}

/**
 * Converte datetime-local ou ISO para ISO UTC.
 * Valores sem fuso explícito (yyyy-MM-ddTHH:mm) são sempre interpretados como São Paulo,
 * independentemente do fuso do servidor (ex.: Vercel em UTC).
 */
export function datetimeLocalSpToIso(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  if (/Z$/i.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const normalized = normalizeDatetimeLocal(trimmed);
  if (!normalized) return null;

  const d = new Date(`${normalized}${SP_UTC_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mesma regra de {@link datetimeLocalSpToIso}, retornando epoch ms. */
export function datetimeLocalSpToMs(
  value: string | null | undefined
): number | null {
  const iso = datetimeLocalSpToIso(value);
  if (!iso) return null;
  return new Date(iso).getTime();
}
