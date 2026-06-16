import type {
  AtividadeComPessoa,
  OutlookEventoComPessoa,
  OutlookEventoStatus,
  ReuniaoComRelacoes,
} from "@/types/database";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";
import type { ColaboradorOpt } from "@/lib/colaboradores";

export type CalendarioItemKind = "outlook" | "reuniao" | "atividade";

export type CalendarioItem = OutlookEventoComPessoa & {
  itemKind: CalendarioItemKind;
  /** ID do registro na tabela de origem. */
  sourceId: string;
  reuniao?: ReuniaoComRelacoes;
  atividade?: AtividadeComPessoa;
};

export type CalendarioTipoFiltro = "TODOS" | "REUNIOES" | "ATIVIDADES";

/** Dono do calendário Outlook vinculado à reunião (não quem categorizou). */
export type DonoCalendarioOutlook = {
  pessoa_id: string;
  pessoa: OutlookEventoComPessoa["pessoa"];
};

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

export function buildDonoCalendarioMap(
  outlook: OutlookEventoComPessoa[],
  reunioes: ReuniaoComRelacoes[] = []
): Map<string, DonoCalendarioOutlook> {
  const map = new Map<string, DonoCalendarioOutlook>();

  for (const e of outlook) {
    if (e.reuniao_id) {
      map.set(e.reuniao_id, {
        pessoa_id: e.pessoa_id,
        pessoa: e.pessoa ?? null,
      });
    }
  }

  for (const r of reunioes) {
    if (map.has(r.id) || !r.outlook_event_id) continue;
    const ev = outlook.find(
      (e) => e.outlook_event_id === r.outlook_event_id
    );
    if (ev) {
      map.set(r.id, {
        pessoa_id: ev.pessoa_id,
        pessoa: ev.pessoa ?? null,
      });
    }
  }

  return map;
}

export function reuniaoVisivelParaUsuario(
  r: ReuniaoComRelacoes,
  usuarioId: string,
  donoPorReuniao: Map<string, DonoCalendarioOutlook>
): boolean {
  if (r.criado_por_id === usuarioId) return true;
  if (donoPorReuniao.get(r.id)?.pessoa_id === usuarioId) return true;
  return (r.participantes ?? []).some(
    (p) => p.colaborador?.usuario_id === usuarioId
  );
}

export function reuniaoToCalendarioItem(
  r: ReuniaoComRelacoes,
  dono?: DonoCalendarioOutlook | null
): CalendarioItem {
  const base = emptyOutlookFields({
    id: `reuniao-${r.id}`,
    pessoa_id: dono?.pessoa_id ?? r.criado_por_id ?? "",
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
    pessoa: dono?.pessoa ?? null,
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
  atividades: AtividadeComPessoa[],
  donoPorReuniao?: Map<string, DonoCalendarioOutlook>
): CalendarioItem[] {
  const items: CalendarioItem[] = [];
  const dono = donoPorReuniao ?? buildDonoCalendarioMap(outlook, reunioes);

  for (const e of outlook) {
    if (OUTLOOK_OCULTOS.includes(e.status)) continue;
    items.push(outlookToCalendarioItem(e));
  }
  for (const r of reunioes) {
    items.push(reuniaoToCalendarioItem(r, dono.get(r.id)));
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

/** Organizador + convidados + dono do calendário (sem duplicar e-mail). */
export function emailsEnvolvidosOutlook(
  e: Pick<
    OutlookEventoComPessoa,
    "organizador_email" | "organizador_nome" | "participantes" | "pessoa"
  >
): { nome: string; email: string; organizador: boolean }[] {
  const porEmail = new Map<
    string,
    { nome: string; email: string; organizador: boolean }
  >();

  function add(
    email: string | null | undefined,
    nome: string | null | undefined,
    organizador = false
  ) {
    if (!email?.trim()) return;
    const key = email.trim().toLowerCase();
    const atual = porEmail.get(key);
    if (atual) {
      if (organizador) porEmail.set(key, { ...atual, organizador: true });
      return;
    }
    porEmail.set(key, {
      nome: nome?.trim() || email,
      email: email.trim(),
      organizador,
    });
  }

  add(e.organizador_email, e.organizador_nome, true);
  add(e.pessoa?.email, e.pessoa?.nome);
  for (const p of e.participantes ?? []) {
    add(p.email, p.nome);
  }

  return [...porEmail.values()];
}

/** Colaboradores internos que correspondem aos envolvidos do evento Outlook. */
export function colaboradorIdsDeEnvolvidos(
  colaboradores: ColaboradorOpt[],
  e: Pick<
    OutlookEventoComPessoa,
    "organizador_email" | "organizador_nome" | "participantes" | "pessoa"
  > & { pessoa_id?: string }
): string[] {
  const envolvidos = emailsEnvolvidosOutlook(e);
  const ids = new Set<string>();

  for (const c of colaboradores) {
    const porEmail = envolvidos.some((a) =>
      emailsEscritorioIguais(a.email, c.email)
    );
    const porUsuario =
      Boolean(e.pessoa_id && c.usuario_id) && c.usuario_id === e.pessoa_id;
    if (porEmail || porUsuario) ids.add(c.id);
  }

  return [...ids];
}
