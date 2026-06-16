/** yyyy-MM-ddTHH:mm → DD/MM/AAAA HH:mm */
export function formatDatetimeLocalBr(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return local;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** DD/MM/AAAA HH:mm → yyyy-MM-ddTHH:mm (fuso local do navegador) ou null se inválido. */
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
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;

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
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return null;
  }
}
