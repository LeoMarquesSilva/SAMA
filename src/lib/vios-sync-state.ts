import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

/** Limite documentado pela API VIOS (integração BP). */
export const VIOS_RATE_LIMIT_REQUESTS = 6;
export const VIOS_RATE_LIMIT_WINDOW_MINUTES = 1380;

/** Intervalo mínimo entre syncs no SAMA (conservador vs. 6 req / 23 h). */
export const VIOS_SYNC_COOLDOWN_MINUTES = Number(
  process.env.VIOS_SYNC_COOLDOWN_MINUTES ?? "240"
);

export type ViosSyncEstado = {
  recurso: string;
  ultima_sincronia: string | null;
  bloqueado_ate: string | null;
  ultimo_erro: string | null;
  consultas_no_ciclo: number;
  ciclo_inicio: string | null;
};

export type ViosSyncPermissao = {
  permitido: boolean;
  motivo?: string;
  proximaEm?: string;
  usandoCache?: boolean;
};

const RECURSO_TAREFAS = "tarefas";

export async function getViosSyncEstado(
  recurso = RECURSO_TAREFAS
): Promise<ViosSyncEstado | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vios_sync_estado")
    .select("*")
    .eq("recurso", recurso)
    .maybeSingle();

  if (!data) return null;
  return data as ViosSyncEstado;
}

export function avaliarSyncVios(
  estado: ViosSyncEstado | null,
  opts?: { forcar?: boolean }
): ViosSyncPermissao {
  const agora = Date.now();

  if (estado?.bloqueado_ate) {
    const bloqueado = new Date(estado.bloqueado_ate).getTime();
    if (bloqueado > agora) {
      return {
        permitido: false,
        proximaEm: estado.bloqueado_ate,
        usandoCache: true,
        motivo: `Cota da API VIOS esgotada (6 consultas a cada ${VIOS_RATE_LIMIT_WINDOW_MINUTES} min). Próxima tentativa após ${formatarProxima(estado.bloqueado_ate)}.`,
      };
    }
  }

  if (!opts?.forcar && estado?.ultima_sincronia) {
    const cooldownMs = VIOS_SYNC_COOLDOWN_MINUTES * 60_000;
    const proxima = new Date(estado.ultima_sincronia).getTime() + cooldownMs;
    if (proxima > agora) {
      return {
        permitido: false,
        proximaEm: new Date(proxima).toISOString(),
        usandoCache: true,
        motivo: `Aguarde o intervalo mínimo entre syncs (${VIOS_SYNC_COOLDOWN_MINUTES} min). Próxima tentativa após ${formatarProxima(new Date(proxima).toISOString())}.`,
      };
    }
  }

  return { permitido: true };
}

export async function registrarSyncViosSucesso(
  recurso = RECURSO_TAREFAS
): Promise<void> {
  const supabase = createAdminClient();
  const agora = new Date().toISOString();
  const estado = await getViosSyncEstado(recurso);

  let consultas = 1;
  let cicloInicio = agora;

  if (estado?.ciclo_inicio) {
    const cicloMs = VIOS_RATE_LIMIT_WINDOW_MINUTES * 60_000;
    const cicloFim =
      new Date(estado.ciclo_inicio).getTime() + cicloMs;
    if (Date.now() < cicloFim) {
      consultas = (estado.consultas_no_ciclo ?? 0) + 1;
      cicloInicio = estado.ciclo_inicio;
    }
  }

  await supabase.from("vios_sync_estado").upsert(
    {
      recurso,
      ultima_sincronia: agora,
      bloqueado_ate: null,
      ultimo_erro: null,
      consultas_no_ciclo: consultas,
      ciclo_inicio: cicloInicio,
      updated_at: agora,
    },
    { onConflict: "recurso" }
  );
}

export async function registrarSyncViosRateLimit(
  mensagem: string,
  recurso = RECURSO_TAREFAS
): Promise<void> {
  const supabase = createAdminClient();
  const agora = new Date();
  const bloqueadoAte = new Date(
    agora.getTime() + VIOS_RATE_LIMIT_WINDOW_MINUTES * 60_000
  ).toISOString();

  await supabase.from("vios_sync_estado").upsert(
    {
      recurso,
      bloqueado_ate: bloqueadoAte,
      ultimo_erro: mensagem,
      updated_at: agora.toISOString(),
    },
    { onConflict: "recurso" }
  );
}

export async function registrarImportCsvSucesso(
  total: number,
  recurso = RECURSO_TAREFAS
): Promise<void> {
  const supabase = createAdminClient();
  const agora = new Date().toISOString();
  await supabase.from("vios_sync_estado").upsert(
    {
      recurso,
      ultima_sincronia: agora,
      ultimo_erro: `Importação CSV: ${total} tarefa(s)`,
      updated_at: agora,
    },
    { onConflict: "recurso" }
  );
}

export async function registrarSyncViosErro(
  mensagem: string,
  recurso = RECURSO_TAREFAS
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("vios_sync_estado")
    .upsert(
      {
        recurso,
        ultimo_erro: mensagem,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "recurso" }
    );
}

function formatarProxima(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
