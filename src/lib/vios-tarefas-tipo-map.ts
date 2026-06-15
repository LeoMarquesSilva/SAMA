import type { TipoAtividade } from "@/types/database";
import { TIPO_ATIVIDADE_INTERNA, type TipoAtividadeKey } from "@/lib/constants";
import { normalizeNomeCompare } from "@/lib/vios-tarefas-utils";

/** Nome exato da tarefa pai VIOS → tipo de atividade SAMA. */
const TIPO_POR_NOME_TAREFA_PAI: Record<string, TipoAtividade> = {
  "2. REVISAR": "REVISAO_PRAZO",
  "AUDIÊNCIA UNA/INICIAL": "AUDIENCIA",
  "SESSÃO DE JULGAMENTO": "AUDIENCIA",
  "DESPACHO/MEDIAÇÃO - ONLINE": "DESPACHO",
  "PROPOSTA/CONTRATO DE HONORÁRIOS": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
  "AUD. CONCILIAÇÃO": "AUDIENCIA",
  "ENVIAR DUE DILLIGENCE PROSPECT": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
  "PROTOCOLO DUE DILLIGENCE PROSPECT": "LEVANTAMENTO_DUE_PROPOSTA_CONTRATO",
};

const TIPO_POR_NOME_NORMALIZADO = Object.fromEntries(
  Object.entries(TIPO_POR_NOME_TAREFA_PAI).map(([nome, tipo]) => [
    normalizeNomeCompare(nome),
    tipo,
  ])
) as Record<string, TipoAtividade>;

export const TIPOS_ATIVIDADE_AUTO_VIOS = [
  ...new Set(Object.values(TIPO_POR_NOME_TAREFA_PAI)),
] as TipoAtividade[];

function lookupNomeTarefa(raw: string | null | undefined): TipoAtividade | null {
  const norm = normalizeNomeCompare(raw ?? "");
  if (!norm) return null;
  return TIPO_POR_NOME_NORMALIZADO[norm] ?? null;
}

/**
 * Resolve o tipo pela tarefa pai VIOS (match exato, normalizado).
 * Fallback na coluna tarefa quando o nome do tipo vem ali (ex.: "2. REVISAR").
 */
export function tipoAtividadePorTarefaPai(t: {
  tarefa_pai?: string | null;
  tarefa?: string | null;
}): TipoAtividade | null {
  return lookupNomeTarefa(t.tarefa_pai) ?? lookupNomeTarefa(t.tarefa);
}

export function isTarefaAutoClassificavel(t: {
  tarefa_pai?: string | null;
  tarefa?: string | null;
}): boolean {
  return tipoAtividadePorTarefaPai(t) !== null;
}

/** Mantém só tarefas cujo tipo está no mapa VIOS. */
export function filtrarTarefasViosMapeadas<
  T extends { tarefa_pai?: string | null; tarefa?: string | null },
>(rows: T[]): T[] {
  return rows.filter(isTarefaAutoClassificavel);
}

/** Tipos disponíveis ao reclassificar tarefa VIOS (somente os mapeados). */
export function atividadeTipoOptionsVios() {
  return TIPOS_ATIVIDADE_AUTO_VIOS.map((k) => ({
    value: k,
    label: TIPO_ATIVIDADE_INTERNA[k as TipoAtividadeKey],
  }));
}
