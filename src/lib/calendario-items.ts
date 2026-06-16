import type {
  AtividadeComPessoa,
  OutlookEventoComPessoa,
  OutlookEventoStatus,
  ReuniaoComRelacoes,
} from "@/types/database";

export type CalendarioItemKind = "outlook" | "reuniao" | "atividade";

export type CalendarioItem = OutlookEventoComPessoa & {
  itemKind: CalendarioItemKind;
  /** ID do registro na tabela de origem. */
  sourceId: string;
  reuniao?: ReuniaoComRelacoes;
  atividade?: AtividadeComPessoa;
};

export type CalendarioTipoFiltro = "TODOS" | "REUNIOES" | "ATIVIDADES";

const OUTLOOK_OCULTOS: OutlookEventoStatus[] = [
  "CATEGORIZADO_REUNIAO",
  "CATEGORIZADO_ATIVIDADE",
];

function emptyOutlookFields(
  partial: Partial<OutlookEventoComPessoa>
): OutlookEventoComPessoa {
  return {
    id: partial.id ?? "",
    pessoa_id: partial.pessoa_id ?? "",
    outlook_event_id: partial.outlook_event_id ?? "",
    titulo: partial.titulo ?? null,
    inicio: partial.inicio ?? null,
    fim: partial.fim ?? null,
    duracao_minutos: partial.duracao_minutos ?? null,
    local: partial.local ?? null,
    online: partial.online ?? false,
    link_online: partial.link_online ?? null,
    organizador_nome: partial.organizador_nome ?? null,
    organizador_email: partial.organizador_email ?? null,
    participantes: partial.participantes ?? [],
    corpo_preview: partial.corpo_preview ?? null,
    status: partial.status ?? "PENDENTE",
    reuniao_id: partial.reuniao_id ?? null,
    atividade_id: partial.atividade_id ?? null,
    categorizado_em: partial.categorizado_em ?? null,
    criado_em: partial.criado_em ?? "",
    atualizado_em: partial.atualizado_em ?? "",
    pessoa: partial.pessoa ?? null,
  };
}

export function outlookToCalendarioItem(e: OutlookEventoComPessoa): CalendarioItem {
  return {
    ...e,
    itemKind: "outlook",
    sourceId: e.id,
  };
}

export function reuniaoToCalendarioItem(r: ReuniaoComRelacoes): CalendarioItem {
  const base = emptyOutlookFields({
    id: `reuniao-${r.id}`,
    pessoa_id: r.criado_por_id ?? "",
    outlook_event_id: r.outlook_event_id ?? "",
    titulo: r.titulo,
    inicio: r.data_hora_inicio,
    fim: r.data_hora_fim,
    duracao_minutos: r.duracao_minutos,
    local: r.local,
    online: r.modalidade === "ONLINE",
    link_online: r.link_online,
    participantes: [],
    status: "CATEGORIZADO_REUNIAO",
    reuniao_id: r.id,
    criado_em: r.criado_em,
    atualizado_em: r.atualizado_em,
  });
  return {
    ...base,
    itemKind: "reuniao",
    sourceId: r.id,
    reuniao: r,
  };
}

export function atividadeToCalendarioItem(a: AtividadeComPessoa): CalendarioItem {
  const base = emptyOutlookFields({
    id: `atividade-${a.id}`,
    pessoa_id: a.pessoa_id,
    outlook_event_id: a.outlook_event_id ?? "",
    titulo: a.titulo,
    inicio: a.data_hora_inicio,
    fim: a.data_hora_fim,
    duracao_minutos: a.duracao_minutos,
    corpo_preview: a.descricao,
    status: "CATEGORIZADO_ATIVIDADE",
    atividade_id: a.id,
    pessoa: a.pessoa ? { ...a.pessoa, email: "" } : null,
    criado_em: a.criado_em,
    atualizado_em: a.atualizado_em,
  });
  return {
    ...base,
    itemKind: "atividade",
    sourceId: a.id,
    atividade: a,
  };
}

export function mergeCalendarioItems(
  outlook: OutlookEventoComPessoa[],
  reunioes: ReuniaoComRelacoes[],
  atividades: AtividadeComPessoa[]
): CalendarioItem[] {
  const items: CalendarioItem[] = [];

  for (const e of outlook) {
    if (OUTLOOK_OCULTOS.includes(e.status)) continue;
    items.push(outlookToCalendarioItem(e));
  }
  for (const r of reunioes) {
    items.push(reuniaoToCalendarioItem(r));
  }
  for (const a of atividades) {
    items.push(atividadeToCalendarioItem(a));
  }

  return items.sort((a, b) => {
    const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
    const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
    return tb - ta;
  });
}

export function itemMatchesTipo(
  item: CalendarioItem,
  tipo: CalendarioTipoFiltro
): boolean {
  if (tipo === "TODOS") return true;
  if (tipo === "REUNIOES") {
    return item.itemKind === "reuniao" || item.itemKind === "outlook";
  }
  return item.itemKind === "atividade";
}

export function isOutlookPendente(item: CalendarioItem): boolean {
  return item.itemKind === "outlook" && item.status === "PENDENTE";
}
