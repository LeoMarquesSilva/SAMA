import { formatTimeInTz, APP_TIMEZONE, toDatetimeLocalInTz } from "@/lib/timezone";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const time = formatTimeInTz(iso);
    const date = new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
    return `${date} ${time}`;
  } catch {
    return "—";
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

/** Data/hora de conclusão da atividade (fim explícito, início + duração, ou início). */
export function atividadeDataConclusaoIso(a: {
  data_hora_inicio: string;
  data_hora_fim?: string | null;
  duracao_minutos?: number | null;
}): string {
  if (a.data_hora_fim) return a.data_hora_fim;
  const min = a.duracao_minutos ?? 0;
  if (min > 0 && a.data_hora_inicio) {
    const t = new Date(a.data_hora_inicio).getTime();
    if (!Number.isNaN(t)) {
      return new Date(t + min * 60000).toISOString();
    }
  }
  return a.data_hora_inicio;
}

/** Converte minutos em "2h 30min" / "45min". */
export function formatDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

/** Diferença em minutos entre dois datetime-local; null se inválido. */
export function diffMinutos(
  inicio?: string | null,
  fim?: string | null
): number | null {
  if (!inicio || !fim) return null;
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

/** Valor para <input type="datetime-local"> a partir de um ISO (fuso SP). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  return toDatetimeLocalInTz(iso);
}
