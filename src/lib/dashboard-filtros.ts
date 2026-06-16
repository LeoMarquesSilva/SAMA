import {
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";
import {
  endOfDayInstantInTz,
  startOfDayInstantInTz,
  todayKeyInTz,
} from "@/lib/timezone";
import { CALENDARIO_PATH } from "@/lib/calendario";

export type DashboardPeriodo = "dia" | "mes" | "3m" | "6m" | "ano";

export function parseDashboardDayKey(raw?: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return todayKeyInTz();
}

export function dashboardIntervalo(
  p: DashboardPeriodo,
  dayKey: string
): { de: Date; ate: Date } {
  const now = new Date();
  if (p === "dia") {
    return {
      de: new Date(startOfDayInstantInTz(dayKey)),
      ate: new Date(endOfDayInstantInTz(dayKey)),
    };
  }
  const ate = now;
  if (p === "mes") return { de: startOfMonth(now), ate };
  if (p === "3m") return { de: subMonths(now, 3), ate };
  if (p === "ano") return { de: startOfYear(now), ate };
  return { de: subMonths(now, 6), ate };
}

export type CalendarioFiltroInicial = {
  status: string;
  kind: string;
  tipo: string;
  p: string;
  data: string;
  pessoa: string;
  view: string;
};

export function parseCalendarioFiltroInicial(
  sp: Record<string, string | undefined>
): CalendarioFiltroInicial {
  return {
    status: sp.status ?? "",
    kind: sp.kind ?? "",
    tipo: sp.tipo ?? "",
    p: sp.p ?? "",
    data: sp.data ?? "",
    pessoa: sp.pessoa ?? "",
    view: sp.view ?? "",
  };
}

export function itemNoPeriodoDashboard(
  inicio: string | null | undefined,
  periodo: DashboardPeriodo,
  dayKey: string
): boolean {
  if (!inicio) return false;
  const { de, ate } = dashboardIntervalo(periodo, dayKey);
  const t = new Date(inicio).getTime();
  return t >= de.getTime() && t <= ate.getTime();
}

type LinkCard =
  | { card: "pendente" }
  | { card: "reuniao"; tipo: string }
  | { card: "atividade"; tipo: string };

export function buildCalendarioLinkFromDashboard(
  card: LinkCard,
  opts: {
    periodo: DashboardPeriodo;
    dataDia?: string;
    pessoa?: string;
  }
): string {
  const params = new URLSearchParams();
  params.set("view", "lista");

  if (card.card === "pendente") {
    if (opts.pessoa) params.set("pessoa", opts.pessoa);
    return `${CALENDARIO_PATH}?${params.toString()}`;
  }

  if (card.card === "reuniao") {
    params.set("kind", "reuniao");
    params.set("tipo", card.tipo);
    params.set("status", "REALIZADA");
  } else {
    params.set("kind", "atividade");
    params.set("tipo", card.tipo);
    params.set("status", "REALIZADA");
  }

  params.set("p", opts.periodo);
  if (opts.periodo === "dia") {
    params.set("data", opts.dataDia || todayKeyInTz());
  }
  if (opts.pessoa) params.set("pessoa", opts.pessoa);

  return `${CALENDARIO_PATH}?${params.toString()}`;
}
