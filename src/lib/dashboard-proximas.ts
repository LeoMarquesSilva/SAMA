import {
  buildDonoCalendarioMap,
  reuniaoVisivelParaUsuario,
  type DonoCalendarioOutlook,
} from "@/lib/calendario-items";
import type {
  ModalidadeReuniao,
  OutlookEventoComPessoa,
  ReuniaoComRelacoes,
} from "@/types/database";

export type ProximaReuniaoDashboard = {
  id: string;
  titulo: string;
  modalidade: ModalidadeReuniao;
  data_hora_inicio: string;
  link_online: string | null;
  cliente?: { nome?: string; grupo_cliente?: string | null } | null;
  participantes: {
    colaborador_id?: string;
    colaborador?: {
      nome?: string;
      avatar_url?: string | null;
      usuario_id?: string | null;
    } | null;
  }[];
};

function reuniaoParaProxima(r: ReuniaoComRelacoes): ProximaReuniaoDashboard {
  return {
    id: r.id,
    titulo: r.titulo,
    modalidade: r.modalidade,
    data_hora_inicio: r.data_hora_inicio,
    link_online: r.link_online,
    cliente: r.cliente ?? null,
    participantes: (r.participantes ?? []).map((p) => ({
      colaborador_id: p.colaborador_id ?? undefined,
      colaborador: p.colaborador ?? null,
    })),
  };
}

function outlookParaProxima(e: OutlookEventoComPessoa): ProximaReuniaoDashboard {
  const modalidade: ModalidadeReuniao = e.online
    ? "ONLINE"
    : "PRESENCIAL_ESCRITORIO";

  return {
    id: `outlook-${e.id}`,
    titulo: e.titulo?.trim() || "Sem título",
    modalidade,
    data_hora_inicio: e.inicio ?? new Date().toISOString(),
    link_online: e.link_online,
    cliente: null,
    participantes: (e.participantes ?? []).map((p) => ({
      colaborador: { nome: p.nome || p.email || "?" },
    })),
  };
}

/** Próximas reuniões do usuário: Outlook pendente + reuniões agendadas visíveis, ordenadas por data. */
export function buildProximasReunioes(
  reunioes: ReuniaoComRelacoes[],
  outlook: OutlookEventoComPessoa[],
  pessoaId: string | null,
  limit = 6
): ProximaReuniaoDashboard[] {
  if (!pessoaId) return [];

  const donoPorReuniao: Map<string, DonoCalendarioOutlook> =
    buildDonoCalendarioMap(outlook, reunioes);

  const reunioesVisiveis = reunioes.filter(
    (r) =>
      r.status === "AGENDADA" &&
      reuniaoVisivelParaUsuario(r, pessoaId, donoPorReuniao)
  );

  const outlookIdsComReuniao = new Set(
    reunioesVisiveis
      .map((r) => r.outlook_event_id)
      .filter((id): id is string => Boolean(id))
  );

  const outlookPendentes = outlook.filter(
    (e) =>
      e.pessoa_id === pessoaId &&
      e.status === "PENDENTE" &&
      !e.reuniao_id &&
      !e.atividade_id &&
      !outlookIdsComReuniao.has(e.outlook_event_id)
  );

  return [...reunioesVisiveis.map(reuniaoParaProxima), ...outlookPendentes.map(outlookParaProxima)]
    .sort(
      (a, b) =>
        new Date(a.data_hora_inicio).getTime() -
        new Date(b.data_hora_inicio).getTime()
    )
    .slice(0, limit);
}
