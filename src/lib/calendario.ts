import type { SupabaseClient } from "@supabase/supabase-js";
import type { CargoPessoa } from "@/lib/constants";
import { canViewAgendaTodos } from "@/lib/constants";
import { SP_UTC_OFFSET } from "@/lib/datetime-br";

export const CALENDARIO_PATH = "/calendario";

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
