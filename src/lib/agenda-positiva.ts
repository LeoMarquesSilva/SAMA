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

/**
 * Grupos do próprio escritório (Gestão de Equipe e "Grupo Área …"): reunião com
 * eles é interna, não entra no ranking de clientes nem nas sugestões.
 */
export function isGrupoInternoAgenda(grupo: string): boolean {
  return grupo === GRUPO_CLIENTE_GESTAO_EQUIPE || /^Grupo Área\b/i.test(grupo);
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

/** cumprida: atingiu a meta · parcial: teve reunião, abaixo da meta · zerada: nenhuma. */
export type SituacaoMeta = "cumprida" | "parcial" | "zerada";

export function situacaoMeta(realizadas: number, meta: number): SituacaoMeta {
  if (realizadas >= meta) return "cumprida";
  return realizadas > 0 ? "parcial" : "zerada";
}
