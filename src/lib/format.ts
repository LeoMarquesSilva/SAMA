import {
  dayKeyInTz,
  formatDayKeyBr,
  formatTimeInTz,
  toDatetimeLocalInTz,
} from "@/lib/timezone";
import { datetimeLocalSpToMs } from "@/lib/datetime-br";

/** Data no padrão brasileiro: DD/MM/AAAA (fuso SP). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return formatDayKeyBr(dayKeyInTz(iso));
  } catch {
    return "—";
  }
}

/** Data e hora no padrão brasileiro: DD/MM/AAAA HH:mm (fuso SP). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return `${formatDayKeyBr(dayKeyInTz(iso))} ${formatTimeInTz(iso)}`;
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
  const a = datetimeLocalSpToMs(inicio);
  const b = datetimeLocalSpToMs(fim);
  if (a == null || b == null || b <= a) return null;
  return Math.round((b - a) / 60000);
}

/** Valor para <input type="datetime-local"> a partir de um ISO (fuso SP). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  return toDatetimeLocalInTz(iso);
}
