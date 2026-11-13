import { GRUPO_CLIENTE_GESTAO_EQUIPE } from "@/lib/constants";
import { dayKeyInTz, todayKeyInTz } from "@/lib/timezone";

/** Cluster de prioridade (espelha o CHECK de public.agenda_positiva_clientes). */
export const CLUSTERS_AGENDA = [
  { chave: "A", label: "Alta prioridade", curto: "A · Alta" },
  { chave: "B", label: "Média prioridade", curto: "B · Média" },
  { chave: "C", label: "Baixa prioridade", curto: "C · Baixa" },
] as const;

export type ClusterAgenda = (typeof CLUSTERS_AGENDA)[number]["chave"];

export const META_MENSAL_MAX = 30;

export function isClusterAgenda(valor: string): valor is ClusterAgenda {
  return CLUSTERS_AGENDA.some((c) => c.chave === valor);
}

export function labelCluster(cluster: string): string {
  return CLUSTERS_AGENDA.find((c) => c.chave === cluster)?.curto ?? cluster;
}

/** Classes do selo do cluster: A forte, C apagado. */
export const CLUSTER_CLASSES: Record<ClusterAgenda, string> = {
  A: "bg-brand-600 text-white",
  B: "bg-brand-100 text-brand-700",
  C: "bg-slate-100 text-slate-600",
};

export type AgendaPositivaCliente = {
  grupo_cliente: string;
  cluster: ClusterAgenda;
  meta_mensal: number;
};

/** Valor do filtro de cluster para os grupos que ainda não têm cluster nem meta. */
export const FILTRO_SEM_CLUSTER = "sem";

export type FiltroCluster = ClusterAgenda | typeof FILTRO_SEM_CLUSTER | "";

export function parseFiltroCluster(raw?: string): FiltroCluster {
  if (!raw) return "";
  if (raw === FILTRO_SEM_CLUSTER || isClusterAgenda(raw)) return raw;
  return "";
}

/**
 * Situação do grupo no mês escolhido. "agendada" só vale no mês em curso;
 * "realizada" é a de quem não tem meta e teve reunião.
 */
export type SituacaoGrupo = "zerada" | "parcial" | "agendada" | "realizada" | "cumprida";

/** Uma linha do dashboard: um grupo cliente e suas reuniões nos meses da grade. */
export type LinhaGrupoAgenda = {
  grupo: string;
  cluster: ClusterAgenda | null;
  meta: number | null;
  /** Reuniões realizadas em cada mês da grade, na ordem dos meses. */
  porMes: number[];
  /** Quantas de porMes vieram do Outlook sem classificação (achadas pelo título). */
  outlookPorMes: number[];
  realizadas: number;
  agendadas: number;
  total: number;
  /** Última reunião realizada na grade (ISO) e a mesma data já formatada. */
  ultima: string | null;
  ultimaLabel: string | null;
  situacao: SituacaoGrupo;
  /** Cliente sem grupo no VIOS: a reunião ficou no nome do cadastro. */
  semGrupo: boolean;
  /** Áreas dos processos do grupo. */
  areasCliente: string[];
};

/** Uma reunião contada pelo dashboard, venha do SAMA ou do Outlook. */
export type EncontroAgenda = {
  /** Grupo da tabela de clientes; sem grupo, o nome do cadastro. */
  cliente: string;
  semGrupo: boolean;
  mes: string;
  inicio: string;
  /** Já aconteceu: realizada ou com data passada (ninguém precisa marcar). */
  feita: boolean;
  origem: "sama" | "outlook";
  /** Departamentos de quem estava na reunião (participantes, quem lançou, calendários). */
  areas: string[];
};

/** Áreas de um processo: "Cível | Insolvência" conta nas duas. */
export function separarAreas(area: string | null | undefined): string[] {
  return (area ?? "")
    .split("|")
    .map((a) => a.trim())
    .filter(Boolean);
}

type ReuniaoParaJuntar = {
  cliente: string;
  semGrupo: boolean;
  mes: string;
  inicio: string;
  status: string;
  titulo: string;
  areas: string[];
};

type EventoParaJuntar = {
  grupo: string;
  mes: string;
  inicio: string;
  titulo: string;
  areas: string[];
};

function somarAreas(destino: EncontroAgenda, areas: string[]) {
  for (const a of areas) if (!destino.areas.includes(a)) destino.areas.push(a);
}

function minuto(inicio: string): string {
  return new Date(inicio).toISOString().slice(0, 16);
}

function tituloChave(titulo: string): string {
  return titulo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Junta reuniões do SAMA e eventos do Outlook sem classificação, contando cada
 * compromisso uma vez: o mesmo grupo no mesmo horário é uma reunião só (a cópia
 * no calendário de cada participante, ou a reunião lançada duas vezes). Evento do
 * Outlook com o mesmo título e horário de uma reunião do SAMA também é cópia dela.
 * As áreas dos responsáveis se somam entre as cópias (cada um no seu calendário).
 */
export function juntarEncontros(
  reunioes: ReuniaoParaJuntar[],
  eventos: EventoParaJuntar[],
  agora: Date = new Date()
): EncontroAgenda[] {
  const jaPassou = (inicio: string) => Date.parse(inicio) < agora.getTime();
  const porSlot = new Map<string, EncontroAgenda>();
  const porTituloDoSama = new Map<string, EncontroAgenda>();

  for (const r of reunioes) {
    if (r.status === "CANCELADA") continue;
    const feita =
      r.status === "REALIZADA" ||
      ((r.status === "AGENDADA" || r.status === "REAGENDADA") && jaPassou(r.inicio));
    const chave = `${r.cliente}|${minuto(r.inicio)}`;
    let encontro = porSlot.get(chave);
    if (encontro) {
      encontro.feita ||= feita;
    } else {
      encontro = {
        cliente: r.cliente,
        semGrupo: r.semGrupo,
        mes: r.mes,
        inicio: r.inicio,
        feita,
        origem: "sama",
        areas: [],
      };
      porSlot.set(chave, encontro);
    }
    somarAreas(encontro, r.areas);
    porTituloDoSama.set(`${minuto(r.inicio)}|${tituloChave(r.titulo)}`, encontro);
  }

  for (const e of eventos) {
    const copiaDoSama = porTituloDoSama.get(`${minuto(e.inicio)}|${tituloChave(e.titulo)}`);
    if (copiaDoSama) {
      somarAreas(copiaDoSama, e.areas);
      continue;
    }
    const chave = `${e.grupo}|${minuto(e.inicio)}`;
    const ja = porSlot.get(chave);
    if (ja) {
      somarAreas(ja, e.areas);
      continue;
    }
    porSlot.set(chave, {
      cliente: e.grupo,
      semGrupo: false,
      mes: e.mes,
      inicio: e.inicio,
      feita: jaPassou(e.inicio),
      origem: "outlook",
      areas: [...e.areas],
    });
  }

  return [...porSlot.values()];
}

/** Grupos do VIOS que são áreas do escritório (Operações Legais = Controladoria). */
const GRUPOS_INTERNOS = new Set([GRUPO_CLIENTE_GESTAO_EQUIPE, "Grupo Operações Legais"]);

/**
 * Grupos do próprio escritório (Gestão de Equipe, Operações Legais e "Grupo Área …"):
 * reunião com eles é interna, não entra no dashboard nem nas sugestões.
 */
export function isGrupoInternoAgenda(grupo: string): boolean {
  return GRUPOS_INTERNOS.has(grupo) || /^Grupo Área\b/i.test(grupo);
}

/** "2026-10" — mês no fuso de São Paulo. */
export function mesKeyInTz(instant: Date | string): string {
  return dayKeyInTz(instant).slice(0, 7);
}

export function mesAtualKey(): string {
  return todayKeyInTz().slice(0, 7);
}

export function parseMesKey(raw?: string): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : mesAtualKey();
}

export function somarMeses(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Os `n` meses que terminam em `mes`, do mais antigo ao mais recente. */
export function mesesAte(mes: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(mes, i - (n - 1)));
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function labelMesCurto(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(y).slice(2)}`;
}

export function labelMesLongo(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_LONGOS[m - 1]} de ${y}`;
}

/** "Novembro de 2026" — para título; o CSS capitalize deixaria "De". */
export function labelMesTitulo(mes: string): string {
  const s = labelMesLongo(mes);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** cumprida: atingiu a meta · parcial: teve reunião, abaixo da meta · zerada: nenhuma. */
export type SituacaoMeta = "cumprida" | "parcial" | "zerada";

export function situacaoMeta(realizadas: number, meta: number): SituacaoMeta {
  if (realizadas >= meta) return "cumprida";
  return realizadas > 0 ? "parcial" : "zerada";
}
