import type {
  AtividadeComPessoa,
  OutlookEventoComPessoa,
  OutlookEventoStatus,
  ReuniaoComRelacoes,
} from "@/types/database";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";
import type { ColaboradorOpt } from "@/lib/colaboradores";

export type CalendarioItemKind = "outlook" | "reuniao" | "atividade";

export type CalendarioPessoaResumo = {
  id: string;
  nome: string;
  avatar_url?: string | null;
};

export type CalendarioGrupoReuniao = {
  reuniao: ReuniaoComRelacoes;
  pessoa: CalendarioPessoaResumo | null;
};

export type CalendarioGrupoOutlook = {
  item: CalendarioItem;
  pessoa: CalendarioPessoaResumo | null;
};

export type CalendarioItem = OutlookEventoComPessoa & {
  itemKind: CalendarioItemKind;
  /** ID do registro na tabela de origem. */
  sourceId: string;
  reuniao?: ReuniaoComRelacoes;
  atividade?: AtividadeComPessoa;
  /** Visão admin: sócios envolvidos no mesmo evento/reunião. */
  grupoPessoas?: CalendarioPessoaResumo[];
  grupoReunioes?: CalendarioGrupoReuniao[];
  grupoOutlook?: CalendarioGrupoOutlook[];
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

const STATUS_CATEGORIZADO: OutlookEventoStatus[] = [
  "CATEGORIZADO_REUNIAO",
  "CATEGORIZADO_ATIVIDADE",
];

/** Usuário já vinculou o próprio evento Outlook a esta reunião. */
export function reuniaoCategorizadaPorUsuario(
  reuniaoId: string,
  usuarioId: string,
  outlook: Pick<OutlookEventoComPessoa, "reuniao_id" | "pessoa_id" | "status">[]
): boolean {
  return outlook.some(
    (e) =>
      e.reuniao_id === reuniaoId &&
      e.pessoa_id === usuarioId &&
      STATUS_CATEGORIZADO.includes(e.status)
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
  donoPorReuniao?: Map<string, DonoCalendarioOutlook>,
  /** Quando informado, só inclui reuniões que este usuário já categorizou. */
  usuarioCalendarioId?: string | null
): CalendarioItem[] {
  const items: CalendarioItem[] = [];
  const dono = donoPorReuniao ?? buildDonoCalendarioMap(outlook, reunioes);

  for (const e of outlook) {
    if (OUTLOOK_OCULTOS.includes(e.status)) continue;
    items.push(outlookToCalendarioItem(e));
  }
  for (const r of reunioes) {
    if (
      usuarioCalendarioId &&
      !reuniaoCategorizadaPorUsuario(r.id, usuarioCalendarioId, outlook)
    ) {
      continue;
    }
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

function chaveGrupoSlot(item: CalendarioItem): string | null {
  const titulo = (item.reuniao?.titulo ?? item.titulo ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const inicio = item.inicio
    ? new Date(item.inicio).toISOString().slice(0, 16)
    : "";
  if (titulo && inicio) return `slot:${titulo}|${inicio}`;
  return null;
}

function pessoaResumoDeItem(
  item: CalendarioItem
): CalendarioPessoaResumo | null {
  if (!item.pessoa?.id) return null;
  return {
    id: item.pessoa.id,
    nome: item.pessoa.nome,
    avatar_url: item.pessoa.avatar_url,
  };
}

function mergeGrupoCalendarioAdmin(
  grupo: CalendarioItem[],
  grupoKey: string
): CalendarioItem {
  const sorted = [...grupo].sort((a, b) => {
    if (a.itemKind === "reuniao" && b.itemKind !== "reuniao") return -1;
    if (b.itemKind === "reuniao" && a.itemKind !== "reuniao") return 1;

    const aResumo = (a.reuniao?.resultado ?? "").length;
    const bResumo = (b.reuniao?.resultado ?? "").length;
    if (aResumo !== bResumo) return bResumo - aResumo;

    return (a.criado_em ?? "").localeCompare(b.criado_em ?? "");
  });
  const canonical = sorted[0];

  const pessoasMap = new Map<string, CalendarioPessoaResumo>();
  const grupoReunioes: CalendarioGrupoReuniao[] = [];
  const grupoOutlook: CalendarioGrupoOutlook[] = [];

  for (const item of grupo) {
    const pessoa = pessoaResumoDeItem(item);
    if (pessoa) pessoasMap.set(pessoa.id, pessoa);

    if (item.itemKind === "reuniao" && item.reuniao) {
      grupoReunioes.push({ reuniao: item.reuniao, pessoa });
    } else if (item.itemKind === "outlook") {
      grupoOutlook.push({ item, pessoa });
    }
  }

  const grupoPessoas = [...pessoasMap.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );
  const temPendente = grupoOutlook.some((g) => g.item.status === "PENDENTE");

  return {
    ...canonical,
    id: `grupo-cal-${grupoKey}`,
    itemKind: temPendente ? "outlook" : canonical.itemKind,
    status: temPendente ? "PENDENTE" : canonical.status,
    grupoPessoas,
    grupoReunioes: grupoReunioes.length ? grupoReunioes : undefined,
    grupoOutlook: grupoOutlook.length ? grupoOutlook : undefined,
    pessoa: grupoPessoas[0]
      ? {
          id: grupoPessoas[0].id,
          nome: grupoPessoas[0].nome,
          email: "",
          avatar_url: grupoPessoas[0].avatar_url,
        }
      : canonical.pessoa,
  };
}

/** Agrupa reuniões/eventos duplicados (mesmo título + horário). */
export function agruparReunioesDuplicadasAdmin(
  items: CalendarioItem[]
): CalendarioItem[] {
  const agrupaveis: CalendarioItem[] = [];
  const outros: CalendarioItem[] = [];

  for (const item of items) {
    if (
      (item.itemKind === "reuniao" || item.itemKind === "outlook") &&
      chaveGrupoSlot(item)
    ) {
      agrupaveis.push(item);
    } else {
      outros.push(item);
    }
  }

  const grupos = new Map<string, CalendarioItem[]>();
  for (const item of agrupaveis) {
    const key = chaveGrupoSlot(item)!;
    const arr = grupos.get(key) ?? [];
    arr.push(item);
    grupos.set(key, arr);
  }

  const agrupados: CalendarioItem[] = [];
  for (const [key, grupo] of grupos) {
    agrupados.push(
      grupo.length === 1 ? grupo[0] : mergeGrupoCalendarioAdmin(grupo, key)
    );
  }

  return [...outros, ...agrupados].sort((a, b) => {
    const ta = a.inicio ? new Date(a.inicio).getTime() : 0;
    const tb = b.inicio ? new Date(b.inicio).getTime() : 0;
    return tb - ta;
  });
}

/** Rótulo dos sócios donos do item (agrupado ou individual). */
export function calendarioSocioLabel(item: CalendarioItem): string | undefined {
  if (item.grupoPessoas?.length) {
    return item.grupoPessoas.map((p) => p.nome).join(", ");
  }
  return item.pessoa?.nome;
}

/** Filtro admin por pessoa — inclui grupos em que o sócio participa. */
export function itemGrupoVisivelParaUsuario(
  item: CalendarioItem,
  usuarioId: string,
  outlook: Pick<OutlookEventoComPessoa, "reuniao_id" | "pessoa_id" | "status">[]
): boolean {
  if (item.grupoPessoas?.length) {
    return item.grupoPessoas.some((p) => p.id === usuarioId);
  }
  if (item.grupoReunioes?.length) {
    return reuniaoGrupoVisivelParaUsuario(item, usuarioId, outlook);
  }
  if (item.grupoOutlook?.length) {
    return item.grupoOutlook.some((g) => g.pessoa?.id === usuarioId);
  }
  if (item.itemKind === "outlook") return item.pessoa_id === usuarioId;
  if (item.reuniao) {
    return reuniaoCategorizadaPorUsuario(item.reuniao.id, usuarioId, outlook);
  }
  return false;
}

/** Quantos eventos pendentes o item representa (agrupado ou individual). */
export function countPendentesNoItem(item: CalendarioItem): number {
  if (item.grupoOutlook?.length) {
    return item.grupoOutlook.filter((g) => g.item.status === "PENDENTE").length;
  }
  return item.itemKind === "outlook" && item.status === "PENDENTE" ? 1 : 0;
}

/** Filtro admin por pessoa — inclui grupos em que o sócio categorizou. */
export function reuniaoGrupoVisivelParaUsuario(
  item: CalendarioItem,
  usuarioId: string,
  outlook: Pick<OutlookEventoComPessoa, "reuniao_id" | "pessoa_id" | "status">[]
): boolean {
  if (item.grupoReunioes?.length) {
    return item.grupoReunioes.some((g) =>
      reuniaoCategorizadaPorUsuario(g.reuniao.id, usuarioId, outlook)
    );
  }
  if (item.reuniao) {
    return reuniaoCategorizadaPorUsuario(item.reuniao.id, usuarioId, outlook);
  }
  return false;
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
  if (item.grupoOutlook?.length) {
    return item.grupoOutlook.some((g) => g.item.status === "PENDENTE");
  }
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
