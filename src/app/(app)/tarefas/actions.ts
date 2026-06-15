"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import {
  ViosApiError,
  defaultTarefasRange,
  fetchViosTarefas,
  normalizeNomeLista,
  tarefaEnvolveUsuario,
  viosConfigurado,
  type ViosTarefa,
  type ViosTarefasFiltro,
} from "@/lib/vios";
import {
  avaliarSyncVios,
  getViosSyncEstado,
  registrarImportCsvSucesso,
  registrarSyncViosErro,
  registrarSyncViosRateLimit,
  registrarSyncViosSucesso,
  VIOS_RATE_LIMIT_REQUESTS,
  VIOS_RATE_LIMIT_WINDOW_MINUTES,
  VIOS_SYNC_COOLDOWN_MINUTES,
  type ViosSyncEstado,
  type ViosSyncPermissao,
} from "@/lib/vios-sync-state";
import {
  csvRowToDbRow,
  decodeViosCsvBuffer,
  parseViosTarefasCsv,
} from "@/lib/vios-tarefas-csv";
import {
  filtrarTarefasCumpridasPorSocioArea,
  resolveConcluidorSocioAreaId,
  resolveUsuarioIdFromNomes,
} from "@/lib/vios-tarefas-utils";
import { filtrarTarefasViosMapeadas } from "@/lib/vios-tarefas-tipo-map";
import { autoClassificarTarefasAutomaticas } from "@/lib/vios-tarefas-auto-atividade";
import type { ViosTarefaCsvRow } from "@/lib/vios-tarefas-csv";

import type { TipoAtividade } from "@/types/database";

export type ActionResult = { ok: boolean; error?: string };
export type SyncTarefasResult = ActionResult & {
  importados?: number;
  total?: number;
  usandoCache?: boolean;
};
export type ImportCsvResult = ActionResult & {
  importados?: number;
  totalCsv?: number;
  classificadas?: Partial<Record<TipoAtividade, number>>;
};

export type TarefasSyncInfo = {
  estado: ViosSyncEstado | null;
  permissao: ViosSyncPermissao;
  cooldownMinutos: number;
  cotaRequests: number;
  cotaJanelaMinutos: number;
};

function revalidateTarefas() {
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
}

function toRow(t: ViosTarefa, usuarioId: string | null) {
  return {
    ci: String(t.ci),
    ci_do_processo: t.ci_do_processo != null ? String(t.ci_do_processo) : null,
    data_para_conclusao: t.data_para_conclusao || null,
    data_limite: t.data_limite || null,
    horario: t.horario ?? null,
    nro_cnj: t.nro_cnj ?? null,
    area_do_processo: t.area_do_processo ?? null,
    objeto_do_processo: t.objeto_do_processo ?? null,
    pasta: t.pasta ?? null,
    pasta_cliente: t.pasta_cliente ?? null,
    tarefa_pai: t.tarefa_pai != null ? String(t.tarefa_pai) : null,
    tarefa: t.tarefa ?? null,
    descricao: t.descricao ?? null,
    cliente: t.cliente ?? null,
    grupo_cliente: t.grupo_cliente ?? null,
    partes_ativas: t.partes_ativas ?? [],
    partes_passivas: t.partes_passivas ?? [],
    comentarios: normalizeNomeLista(t.comentarios),
    historico: normalizeNomeLista(t.historico),
    responsaveis: normalizeNomeLista(t.responsaveis),
    auxiliares: normalizeNomeLista(t.auxiliares),
    usuario_id: usuarioId,
    sincronizado_em: new Date().toISOString(),
  };
}

function resolveUsuarioId(
  t: ViosTarefa,
  usuarios: { id: string; nome: string }[]
): string | null {
  return resolveUsuarioIdFromNomes(
    [
      ...normalizeNomeLista(t.responsaveis),
      ...normalizeNomeLista(t.auxiliares),
    ],
    usuarios
  );
}

export async function getTarefasSyncInfo(): Promise<TarefasSyncInfo> {
  const estado = await getViosSyncEstado();
  return {
    estado,
    permissao: avaliarSyncVios(estado),
    cooldownMinutos: VIOS_SYNC_COOLDOWN_MINUTES,
    cotaRequests: VIOS_RATE_LIMIT_REQUESTS,
    cotaJanelaMinutos: VIOS_RATE_LIMIT_WINDOW_MINUTES,
  };
}

/** Sincroniza tarefas do VIOS para o Supabase (respeita cota da API). */
export async function sincronizarTarefasVios(
  filtro?: ViosTarefasFiltro,
  opts?: { forcar?: boolean }
): Promise<SyncTarefasResult> {
  if (!viosConfigurado()) {
    return {
      ok: false,
      error: "VIOS_TOKEN não configurado no .env.local.",
    };
  }

  const eu = await getPessoaAtual();
  if (!eu) {
    return { ok: false, error: "Usuário não autenticado." };
  }

  const estado = await getViosSyncEstado();
  const permissao = avaliarSyncVios(estado, opts);
  if (!permissao.permitido) {
    return {
      ok: false,
      error: permissao.motivo,
      usandoCache: permissao.usandoCache,
    };
  }

  const supabase = createAdminClient();
  const range = filtro ?? defaultTarefasRange();

  let tarefas: ViosTarefa[];
  try {
    tarefas = await fetchViosTarefas(range);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar VIOS.";
    if (err instanceof ViosApiError && err.status === 429) {
      await registrarSyncViosRateLimit(msg);
      return {
        ok: false,
        error: `${msg} Os dados já importados continuam disponíveis abaixo.`,
        usandoCache: true,
      };
    }
    await registrarSyncViosErro(msg);
    return { ok: false, error: msg };
  }

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome");

  const listaUsuarios = usuarios ?? [];
  const rows = tarefas.map((t) => toRow(t, resolveUsuarioId(t, listaUsuarios)));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("vios_tarefas")
      .upsert(rows, { onConflict: "ci" });
    if (error) return { ok: false, error: error.message };
  }

  await registrarSyncViosSucesso();
  revalidateTarefas();
  return { ok: true, importados: rows.length, total: tarefas.length };
}

const UPSERT_CHUNK = 100;

async function upsertTarefasRows(
  rows: ReturnType<typeof csvRowToDbRow>[]
): Promise<string | null> {
  const supabase = createAdminClient();
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("vios_tarefas")
      .upsert(chunk, { onConflict: "ci" });
    if (error) return error.message;
  }
  return null;
}

async function loadUsuariosESociosArea(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.from("usuarios").select("id, nome, cargo");
  const listaUsuarios = data ?? [];
  const sociosArea = listaUsuarios.filter((u) => u.cargo === "SOCIO_AREA");
  return { listaUsuarios, sociosArea };
}

function buildTarefasRowsFromCsv(
  parsed: ViosTarefaCsvRow[],
  listaUsuarios: { id: string; nome: string }[],
  sociosArea: { id: string; nome: string }[],
  sincronizadoEm: string
) {
  const filtradas = filtrarTarefasViosMapeadas(
    filtrarTarefasCumpridasPorSocioArea(parsed, sociosArea)
  );
  return filtradas.map((t) =>
    csvRowToDbRow(
      t,
      resolveUsuarioIdFromNomes(
        [...t.responsaveis, ...t.auxiliares],
        listaUsuarios
      ),
      resolveConcluidorSocioAreaId(t.usuario_concluiu, sociosArea),
      sincronizadoEm
    )
  );
}

async function limparTarefasSemConclusaoSocioArea(
  supabase: ReturnType<typeof createAdminClient>
) {
  await supabase.from("vios_tarefas").delete().is("usuario_concluiu_id", null);
}

/** Importa relatório CSV de tarefas baixado manualmente do VIOS (não consome cota da API). */
export async function importarTarefasViosCsv(
  formData: FormData
): Promise<ImportCsvResult> {
  const eu = await getPessoaAtual();
  if (!eu) return { ok: false, error: "Usuário não autenticado." };

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecione um arquivo CSV do VIOS." };
  }

  const buffer = await file.arrayBuffer();
  const content = decodeViosCsvBuffer(buffer);
  const parsed = parseViosTarefasCsv(content);

  if (parsed.length === 0) {
    return {
      ok: false,
      error: "Nenhuma tarefa encontrada no CSV. Verifique se é o relatório de tarefas do VIOS.",
    };
  }

  const supabase = createAdminClient();
  const { listaUsuarios, sociosArea } = await loadUsuariosESociosArea(supabase);

  if (sociosArea.length === 0) {
    return {
      ok: false,
      error: "Nenhum Sócio de Área cadastrado no SAMA para validar conclusões.",
    };
  }

  const agora = new Date().toISOString();
  const rows = buildTarefasRowsFromCsv(parsed, listaUsuarios, sociosArea, agora);

  if (rows.length > 0) {
    const err = await upsertTarefasRows(rows);
    if (err) return { ok: false, error: err };
  }

  await limparTarefasSemConclusaoSocioArea(supabase);

  const cis = rows.map((r) => r.ci);
  const { classificadas } = await autoClassificarTarefasAutomaticas(supabase, {
    cis: cis.length ? cis : undefined,
  });

  await registrarImportCsvSucesso(rows.length);
  revalidateTarefas();
  revalidatePath("/atividades");
  revalidatePath("/timesheet");
  revalidatePath("/dashboard");

  if (rows.length === 0) {
    return {
      ok: true,
      importados: 0,
      totalCsv: parsed.length,
      classificadas: {},
      error:
        `Nenhuma tarefa mapeada cumprida por Sócio de Área (${parsed.length} linha(s) no CSV). ` +
        "Só entram tarefas dos tipos configurados no mapa VIOS (Revisar, Audiência, Despacho, Due/Proposta/Contrato).",
    };
  }

  return {
    ok: true,
    importados: rows.length,
    totalCsv: parsed.length,
    classificadas,
  };
}

/** Consulta ao vivo — evitar uso; consome cota da API. */
export async function listarTarefasViosAoVivo(
  filtro?: ViosTarefasFiltro
): Promise<{ ok: boolean; error?: string; tarefas?: ViosTarefa[] }> {
  if (!viosConfigurado()) {
    return { ok: false, error: "VIOS_TOKEN não configurado." };
  }

  const eu = await getPessoaAtual();
  if (!eu) return { ok: false, error: "Usuário não autenticado." };

  const permissao = avaliarSyncVios(await getViosSyncEstado());
  if (!permissao.permitido) {
    return { ok: false, error: permissao.motivo };
  }

  try {
    let tarefas = await fetchViosTarefas(filtro ?? defaultTarefasRange());
    if (!eu.is_admin) {
      tarefas = tarefas.filter((t) => tarefaEnvolveUsuario(t, eu.nome));
    }
    return { ok: true, tarefas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar VIOS.";
    if (err instanceof ViosApiError && err.status === 429) {
      await registrarSyncViosRateLimit(msg);
    }
    return { ok: false, error: msg };
  }
}

export async function ignorarTarefa(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vios_tarefas")
    .update({ status: "IGNORADO", categorizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao ignorar tarefa." };
  revalidateTarefas();
  return { ok: true };
}

export async function reverterTarefa(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vios_tarefas")
    .update({ status: "PENDENTE", categorizado_em: null })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao reverter tarefa." };
  revalidateTarefas();
  return { ok: true };
}

/** Vincula tarefa VIOS a reunião/atividade criada no modal de reclassificação. */
export async function vincularTarefaCategorizada(
  tarefaId: string,
  tipo: "REUNIAO" | "ATIVIDADE",
  registroId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch =
    tipo === "REUNIAO"
      ? { status: "CATEGORIZADO_REUNIAO" as const, reuniao_id: registroId }
      : { status: "CATEGORIZADO_ATIVIDADE" as const, atividade_id: registroId };

  const { error } = await supabase
    .from("vios_tarefas")
    .update({ ...patch, categorizado_em: new Date().toISOString() })
    .eq("id", tarefaId);
  if (error) return { ok: false, error: "Erro ao vincular tarefa." };
  revalidateTarefas();
  return { ok: true };
}
