import type { SupabaseClient } from "@supabase/supabase-js";
import type { CargoPessoa } from "@/lib/constants";
import { canViewAgendaTodos } from "@/lib/constants";
import { SP_UTC_OFFSET } from "@/lib/datetime-br";

export const CALENDARIO_PATH = "/calendario";

/** Evita sync Outlook logo após refresh manual do calendário (ex.: após categorizar). */
export const CALENDARIO_PAGE_REFRESH_KEY = "sama_cal_page_refreshed_at";
export const CALENDARIO_PAGE_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

/** Select enxuto para listagem do calendário — textos longos vêm no modal via buscarReuniaoPorId. */
export const REUNIAO_CALENDARIO_LIST_SELECT =
  "id, titulo, tipo, modalidade, status, data_hora_inicio, data_hora_fim, duracao_minutos, cliente_id, link_online, local, outlook_event_id, criado_por_id, tema, gravacao_url, ata_arquivo_url, motivo_cancelamento, cancelado_em, criado_em, atualizado_em, cliente:pessoas(ci, nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, papel, nome, email, colaborador:colaboradores(id, nome, avatar_url, email, departamento, usuario_id))";

/** Select enxuto para eventos Outlook na listagem — corpo do convite não é necessário na grade. */
export const OUTLOOK_CALENDARIO_LIST_SELECT =
  "id, pessoa_id, outlook_event_id, titulo, inicio, fim, duracao_minutos, local, online, link_online, organizador_nome, organizador_email, participantes, status, reuniao_id, atividade_id, categorizado_em, criado_em, atualizado_em, pessoa:usuarios(id, nome, email, avatar_url)";

/** Valor de ?pessoa= para carregar todas as agendas (admin). */
export const CALENDARIO_PESSOA_TODOS = "todos";

export type CalendarioPessoaScope =
  | { mode: "all" }
  | { mode: "user"; pessoaId: string };

/** Define o escopo de dados carregados na página do calendário. */
export function resolveCalendarioPessoaScope(
  pessoaParam: string | undefined,
  pessoaAtualId: string | null,
  verAgendaTodos: boolean
): CalendarioPessoaScope {
  if (!verAgendaTodos) {
    return pessoaAtualId
      ? { mode: "user", pessoaId: pessoaAtualId }
      : { mode: "all" };
  }
  if (pessoaParam === CALENDARIO_PESSOA_TODOS) {
    return { mode: "all" };
  }
  if (pessoaParam && pessoaAtualId && pessoaParam !== pessoaAtualId) {
    return { mode: "user", pessoaId: pessoaParam };
  }
  return pessoaAtualId
    ? { mode: "user", pessoaId: pessoaAtualId }
    : { mode: "all" };
}

/** Valor do chip de pessoa ("" = Todos). */
export function calendarioPessoaChipValue(
  pessoaParam: string | undefined,
  pessoaAtualId: string | null,
  verAgendaTodos: boolean
): string {
  if (!verAgendaTodos) return pessoaParam ?? "";
  if (pessoaParam === CALENDARIO_PESSOA_TODOS) return "";
  if (!pessoaParam && pessoaAtualId) return pessoaAtualId;
  return pessoaParam ?? "";
}

/** Converte chip em parâmetro de URL (?pessoa=). null = omitir (agenda própria). */
export function calendarioPessoaSearchParam(
  chipValue: string,
  pessoaAtualId: string | null
): string | null {
  if (!chipValue) return CALENDARIO_PESSOA_TODOS;
  if (pessoaAtualId && chipValue === pessoaAtualId) return null;
  return chipValue;
}

export function markCalendarioPageRefreshed(now = Date.now()) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CALENDARIO_PAGE_REFRESH_KEY, String(now));
}

export function calendarioPageRefreshedRecently(
  withinMs = CALENDARIO_PAGE_REFRESH_COOLDOWN_MS,
  now = Date.now()
): boolean {
  if (typeof window === "undefined") return false;
  const last = Number(sessionStorage.getItem(CALENDARIO_PAGE_REFRESH_KEY) ?? 0);
  return last > 0 && now - last < withinMs;
}

/** Obrigatoriedade de categorizar eventos já ocorridos — 01/07/2026 00:00 (SP). */
export const CATEGORIZACAO_OBRIGATORIA_DESDE_ISO = new Date(
  `2026-07-01T00:00:00${SP_UTC_OFFSET}`
).toISOString();

/** Janela de eventos carregada na UI (dias antes/depois de hoje). */
export const CALENDARIO_LOAD_DAYS_BACK = 30;
export const CALENDARIO_LOAD_DAYS_FORWARD = 90;

/** Intervalo ISO (UTC) para consultas à tabela outlook_eventos. */
export function calendarioEventQueryRange(now = Date.now()): {
  start: string;
  end: string;
} {
  return calendarioSyncRange(now);
}

/** Janela da sincronização Outlook — espelha o que a UI carrega. */
export function calendarioSyncRange(now = Date.now()): {
  start: string;
  end: string;
} {
  return {
    start: new Date(now - CALENDARIO_LOAD_DAYS_BACK * 86400000).toISOString(),
    end: new Date(now + CALENDARIO_LOAD_DAYS_FORWARD * 86400000).toISOString(),
  };
}

/** ISO cutoff: só eventos com início até este instante exigem categorização. */
export function calendarioPendentesExigiveisCutoff(now = Date.now()): string {
  return new Date(now).toISOString();
}

/** Início da janela de pendências exigíveis (obrigatoriedade desde 01/07/2026). */
export function calendarioPendentesExigiveisInicio(): string {
  return CATEGORIZACAO_OBRIGATORIA_DESDE_ISO;
}

/** Conta eventos do calendário aguardando categorização (já ocorridos, desde 01/07/2026). */
export async function countEventosPendentes(
  supabase: SupabaseClient,
  opts: { pessoaId?: string | null; verAgendaTodos?: boolean },
  now = Date.now()
): Promise<number> {
  let q = supabase
    .from("outlook_eventos")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDENTE")
    .gte("inicio", calendarioPendentesExigiveisInicio())
    .lte("inicio", calendarioPendentesExigiveisCutoff(now));
  if (!opts.verAgendaTodos && opts.pessoaId) {
    q = q.eq("pessoa_id", opts.pessoaId);
  }
  const { count } = await q;
  return count ?? 0;
}

export type PessoaAgendaOpts = {
  id?: string | null;
  is_admin: boolean;
  cargo: CargoPessoa;
  departamento?: string | null;
};

export function agendaPendentesQueryOpts(pessoa: PessoaAgendaOpts | null | undefined) {
  return {
    pessoaId: pessoa?.id ?? undefined,
    verAgendaTodos: canViewAgendaTodos(
      pessoa
        ? {
            is_admin: pessoa.is_admin,
            cargo: pessoa.cargo,
            departamento: pessoa.departamento ?? null,
          }
        : null
    ),
  };
}

/** Rota inicial após login — sócio de área com pendências vai direto ao calendário. */
export function landingPath(
  cargo: CargoPessoa | undefined,
  pendentes: number
): string {
  if (cargo === "SOCIO_AREA" && pendentes > 0) return CALENDARIO_PATH;
  return "/dashboard";
}

/** Primeiro acesso: tour do calendário antes do dashboard. */
export function landingPathComOnboarding(opts: {
  cargo?: CargoPessoa;
  pendentes: number;
  onboardingCalendarioConcluido: boolean;
}): string {
  if (!opts.onboardingCalendarioConcluido) return CALENDARIO_PATH;
  return landingPath(opts.cargo, opts.pendentes);
}
