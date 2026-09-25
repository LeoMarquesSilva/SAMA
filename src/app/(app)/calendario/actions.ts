"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { getCalendarEvents, outlookConfigurado } from "@/lib/graph";
import { clearAlertasLoginCookie } from "@/lib/alertas-login";
import { CALENDARIO_PATH, calendarioSyncRange } from "@/lib/calendario";
import { canViewAgendaTodos, podeVerAgendaDe } from "@/lib/constants";
import { alinharRegistrosComOutlook } from "@/lib/outlook-sync-horarios";
import { removerEventosOrfaosOutlook } from "@/lib/outlook-sync-cleanup";

export type ActionResult = { ok: boolean; error?: string };
export type SyncResult = {
  ok: boolean;
  error?: string;
  importados?: number;
  removidos?: number;
  pessoasOk?: number;
  pessoasErro?: number;
  detalhes?: string[];
};

export type PessoaSync = { id: string; email: string; nome: string };

export type SyncPessoaResult = {
  ok: boolean;
  pessoaId: string;
  nome: string;
  importados: number;
  removidos: number;
  error?: string;
};

const SYNC_CONCURRENCY = 3;

function revalidateCalendario() {
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/outlook");
  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  revalidatePath("/proximos-passos");
}

async function resolverPessoasSync(
  escopo: "eu" | "todos"
): Promise<{ pessoas: PessoaSync[]; error?: string }> {
  const supabase = await createClient();
  const eu = await getPessoaAtual();
  const verAgendaTodos = canViewAgendaTodos(eu);

  if (escopo === "todos") {
    if (!verAgendaTodos) {
      return {
        pessoas: [],
        error: "Sem permissão para sincronizar todas as agendas.",
      };
    }
    const { data } = await supabase
      .from("usuarios")
      .select("id, email, nome")
      .not("email", "is", null);
    const pessoas = (data ?? []).filter(
      (p): p is PessoaSync => Boolean(p.email?.trim())
    );
    return { pessoas };
  }

  if (!eu?.email) return { pessoas: [] };
  return {
    pessoas: [{ id: eu.id, email: eu.email, nome: eu.nome }],
  };
}

async function syncPessoaInterna(
  p: PessoaSync,
  start: string,
  end: string
): Promise<SyncPessoaResult> {
  const supabase = await createClient();
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : null;

  try {
    const eventos = await getCalendarEvents(p.email, start, end);
    const graphIds = eventos.map((e) => e.outlookEventId);
    const rows = eventos.map((e) => ({
      pessoa_id: p.id,
      outlook_event_id: e.outlookEventId,
      titulo: e.titulo,
      inicio: e.inicio,
      fim: e.fim,
      duracao_minutos: e.duracaoMinutos,
      local: e.local,
      online: e.online,
      link_online: e.linkOnline,
      organizador_nome: e.organizadorNome,
      organizador_email: e.organizadorEmail,
      participantes: e.participantes,
      corpo_preview: e.corpoPreview,
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from("outlook_eventos").upsert(rows, {
        onConflict: "pessoa_id,outlook_event_id",
      });
      if (error) throw new Error(error.message);
    }

    const cleanup = await removerEventosOrfaosOutlook(supabase, {
      pessoaId: p.id,
      syncStart: start,
      syncEnd: end,
      graphOutlookEventIds: graphIds,
      admin,
    });

    await supabase.from("outlook_sync_logs").insert({
      pessoa_id: p.id,
      eventos_importados: rows.length,
      status: "SUCESSO",
    });

    return {
      ok: true,
      pessoaId: p.id,
      nome: p.nome,
      importados: rows.length,
      removidos: cleanup.removidos,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    await supabase.from("outlook_sync_logs").insert({
      pessoa_id: p.id,
      eventos_importados: 0,
      status: "ERRO",
      mensagem_erro: msg.slice(0, 500),
    });
    return {
      ok: false,
      pessoaId: p.id,
      nome: p.nome,
      importados: 0,
      removidos: 0,
      error: msg.slice(0, 120),
    };
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  }

  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/** Lista pessoas que serão sincronizadas (para progresso no client). */
export async function listarPessoasParaSync(
  escopo: "eu" | "todos" = "eu"
): Promise<{ ok: boolean; pessoas?: PessoaSync[]; error?: string }> {
  if (!outlookConfigurado()) {
    return {
      ok: false,
      error:
        "Credenciais da Microsoft não configuradas (.env: MICROSOFT_TENANT_ID / SHAREPOINT_CLIENT_ID / SHAREPOINT_CLIENT_SECRET).",
    };
  }

  const { pessoas, error } = await resolverPessoasSync(escopo);
  if (error) return { ok: false, error };
  if (pessoas.length === 0) {
    return { ok: false, error: "Nenhuma pessoa com e-mail para sincronizar." };
  }
  return { ok: true, pessoas };
}

/** Sincroniza o calendário de uma pessoa (chamado pelo client com progresso). */
export async function sincronizarOutlookPessoa(
  pessoaId: string
): Promise<SyncPessoaResult> {
  if (!outlookConfigurado()) {
    return {
      ok: false,
      pessoaId,
      nome: "",
      importados: 0,
      removidos: 0,
      error: "Credenciais da Microsoft não configuradas.",
    };
  }

  const eu = await getPessoaAtual();
  if (!eu) {
    return {
      ok: false,
      pessoaId,
      nome: "",
      importados: 0,
      removidos: 0,
      error: "Não autenticado.",
    };
  }

  const supabasePerm = await createClient();
  const { data: alvo } = await supabasePerm
    .from("usuarios")
    .select("id, departamento")
    .eq("id", pessoaId)
    .maybeSingle();
  if (!podeVerAgendaDe(eu, alvo ?? { id: pessoaId })) {
    return {
      ok: false,
      pessoaId,
      nome: eu.nome,
      importados: 0,
      removidos: 0,
      error: "Sem permissão para sincronizar outra pessoa.",
    };
  }

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("usuarios")
    .select("id, email, nome")
    .eq("id", pessoaId)
    .maybeSingle();

  if (!p?.email) {
    return {
      ok: false,
      pessoaId,
      nome: p?.nome ?? "",
      importados: 0,
      removidos: 0,
      error: "Pessoa sem e-mail.",
    };
  }

  const { start, end } = calendarioSyncRange();
  return syncPessoaInterna(
    { id: p.id, email: p.email, nome: p.nome },
    start,
    end
  );
}

/** Alinha horários e revalida após um lote de syncs no client. */
export async function finalizarSyncOutlook(): Promise<ActionResult> {
  const supabase = await createClient();
  await alinharRegistrosComOutlook(supabase);
  revalidateCalendario();
  return { ok: true };
}

/** Sincroniza o calendário da pessoa logada (chamado no login ou pelo client). */
export async function sincronizarCalendarioAutomatico(): Promise<void> {
  if (!outlookConfigurado()) return;

  const eu = await getPessoaAtual();
  if (!eu?.email) return;

  await sincronizarOutlook("eu");
}

/**
 * Sincroniza o calendário das pessoas via Microsoft Graph (app-only).
 * - `escopo`: "todos" (admin/sócio fundador) sincroniza todas as pessoas com e-mail;
 *   "eu" sincroniza apenas a pessoa logada.
 * - Janela alinhada ao calendário da UI (30 dias atrás / 90 à frente).
 * - Upsert do Graph + remoção de eventos órfãos na mesma janela.
 */
export async function sincronizarOutlook(
  escopo: "eu" | "todos" = "eu"
): Promise<SyncResult> {
  if (!outlookConfigurado()) {
    return {
      ok: false,
      error:
        "Credenciais da Microsoft não configuradas (.env: MICROSOFT_TENANT_ID / SHAREPOINT_CLIENT_ID / SHAREPOINT_CLIENT_SECRET).",
    };
  }

  const { pessoas, error } = await resolverPessoasSync(escopo);
  if (error) return { ok: false, error };
  if (pessoas.length === 0) {
    return { ok: false, error: "Nenhuma pessoa com e-mail para sincronizar." };
  }

  const { start, end } = calendarioSyncRange();
  const results = await mapPool(pessoas, SYNC_CONCURRENCY, (p) =>
    syncPessoaInterna(p, start, end)
  );

  let importados = 0;
  let removidos = 0;
  let pessoasOk = 0;
  let pessoasErro = 0;
  const detalhes: string[] = [];

  for (const r of results) {
    importados += r.importados;
    removidos += r.removidos;
    if (r.ok) pessoasOk += 1;
    else {
      pessoasErro += 1;
      if (r.error) detalhes.push(`${r.nome}: ${r.error}`);
    }
  }

  const supabase = await createClient();
  await alinharRegistrosComOutlook(supabase);

  revalidateCalendario();
  return { ok: true, importados, removidos, pessoasOk, pessoasErro, detalhes };
}

export async function ignorarEvento(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outlook_eventos")
    .update({ status: "IGNORADO", categorizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Erro ao ignorar evento." };
  if (!data?.length) {
    return { ok: false, error: "Sem permissão para alterar este evento." };
  }
  revalidateCalendario();
  return { ok: true };
}

export async function reverterEvento(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outlook_eventos")
    .update({ status: "PENDENTE", categorizado_em: null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Erro ao reverter evento." };
  if (!data?.length) {
    return { ok: false, error: "Sem permissão para alterar este evento." };
  }
  revalidateCalendario();
  return { ok: true };
}

/** Desfaz categorização a partir da reunião: evento Outlook volta a PENDENTE. */
export async function reverterCategorizacaoReuniao(
  reuniaoId: string,
  donoCalendarioId?: string | null
): Promise<ActionResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.id) {
    return {
      ok: false,
      error: "Usuário não vinculado ao cadastro. Contate o administrador.",
    };
  }

  const supabase = await createClient();
  const { data: reuniao } = await supabase
    .from("reunioes")
    .select("id, outlook_event_id")
    .eq("id", reuniaoId)
    .maybeSingle();

  if (!reuniao) return { ok: false, error: "Reunião não encontrada." };
  if (!reuniao.outlook_event_id) {
    return { ok: false, error: "Esta reunião não está vinculada ao Outlook." };
  }

  const alvoPessoaId = donoCalendarioId?.trim() || pessoa.id;
  if (!pessoa.is_admin && alvoPessoaId !== pessoa.id) {
    return { ok: false, error: "Sem permissão para reverter esta categorização." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para reverter.",
    };
  }

  const admin = createAdminClient();

  let { data: eventos, error: evErr } = await admin
    .from("outlook_eventos")
    .select("id")
    .eq("reuniao_id", reuniaoId)
    .eq("pessoa_id", alvoPessoaId);

  if (evErr) return { ok: false, error: "Erro ao buscar evento do calendário." };

  if (!eventos?.length) {
    const fallback = await admin
      .from("outlook_eventos")
      .select("id")
      .eq("outlook_event_id", reuniao.outlook_event_id)
      .eq("pessoa_id", alvoPessoaId);
    if (fallback.error) {
      return { ok: false, error: "Erro ao buscar evento do calendário." };
    }
    eventos = fallback.data;
  }

  if (!eventos?.length) {
    return { ok: false, error: "Evento do calendário não encontrado." };
  }

  for (const ev of eventos) {
    const { error } = await admin
      .from("outlook_eventos")
      .update({
        status: "PENDENTE",
        reuniao_id: null,
        categorizado_em: null,
      })
      .eq("id", ev.id);
    if (error) return { ok: false, error: "Erro ao reverter evento." };
  }

  const { count } = await admin
    .from("outlook_eventos")
    .select("id", { count: "exact", head: true })
    .eq("reuniao_id", reuniaoId);

  if (count === 0) {
    const { error: delErr } = await admin
      .from("reunioes")
      .delete()
      .eq("id", reuniaoId);
    if (delErr) return { ok: false, error: "Erro ao excluir reunião." };
  }

  revalidateCalendario();
  revalidatePath("/proximos-passos");
  return { ok: true };
}

/** Desfaz categorização a partir da atividade: evento Outlook volta a PENDENTE. */
export async function reverterCategorizacaoAtividade(
  atividadeId: string,
  donoCalendarioId?: string | null
): Promise<ActionResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.id) {
    return {
      ok: false,
      error: "Usuário não vinculado ao cadastro. Contate o administrador.",
    };
  }

  const supabase = await createClient();
  const { data: atividade } = await supabase
    .from("atividades_internas")
    .select("id, outlook_event_id")
    .eq("id", atividadeId)
    .maybeSingle();

  if (!atividade) return { ok: false, error: "Atividade não encontrada." };
  if (!atividade.outlook_event_id) {
    return { ok: false, error: "Esta atividade não está vinculada ao Outlook." };
  }

  const alvoPessoaId = donoCalendarioId?.trim() || pessoa.id;
  if (!pessoa.is_admin && alvoPessoaId !== pessoa.id) {
    return { ok: false, error: "Sem permissão para reverter esta categorização." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para reverter.",
    };
  }

  const admin = createAdminClient();

  let { data: eventos, error: evErr } = await admin
    .from("outlook_eventos")
    .select("id")
    .eq("atividade_id", atividadeId)
    .eq("pessoa_id", alvoPessoaId);

  if (evErr) return { ok: false, error: "Erro ao buscar evento do calendário." };

  if (!eventos?.length) {
    const fallback = await admin
      .from("outlook_eventos")
      .select("id")
      .eq("outlook_event_id", atividade.outlook_event_id)
      .eq("pessoa_id", alvoPessoaId);
    if (fallback.error) {
      return { ok: false, error: "Erro ao buscar evento do calendário." };
    }
    eventos = fallback.data;
  }

  if (!eventos?.length) {
    return { ok: false, error: "Evento do calendário não encontrado." };
  }

  for (const ev of eventos) {
    const { error } = await admin
      .from("outlook_eventos")
      .update({
        status: "PENDENTE",
        atividade_id: null,
        categorizado_em: null,
      })
      .eq("id", ev.id);
    if (error) return { ok: false, error: "Erro ao reverter evento." };
  }

  const { count } = await admin
    .from("outlook_eventos")
    .select("id", { count: "exact", head: true })
    .eq("atividade_id", atividadeId);

  if (count === 0) {
    const { error: delErr } = await admin
      .from("atividades_internas")
      .delete()
      .eq("id", atividadeId);
    if (delErr) return { ok: false, error: "Erro ao excluir atividade." };
  }

  revalidateCalendario();
  revalidatePath("/timesheet");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Reunião já registrada para o mesmo evento Outlook (outro participante categorizou). */
export async function buscarReuniaoPorOutlookEventId(
  outlookEventId: string
): Promise<string | null> {
  if (!outlookEventId.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("reunioes")
    .select("id")
    .eq("outlook_event_id", outlookEventId.trim())
    .maybeSingle();
  return data?.id ?? null;
}

/** Vincula um evento do calendário a uma reunião/atividade já criada. */
export async function vincularCategorizado(
  eventoId: string,
  tipo: "REUNIAO" | "ATIVIDADE",
  registroId: string
): Promise<ActionResult> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.id) {
    return {
      ok: false,
      error: "Usuário não vinculado ao cadastro. Contate o administrador.",
    };
  }

  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("outlook_eventos")
    .select("pessoa_id, outlook_event_id")
    .eq("id", eventoId)
    .maybeSingle();

  if (!ev) return { ok: false, error: "Evento não encontrado." };
  if (!pessoa.is_admin && ev.pessoa_id !== pessoa.id) {
    return { ok: false, error: "Sem permissão para categorizar este evento." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para categorizar.",
    };
  }

  const admin = createAdminClient();
  const patch =
    tipo === "REUNIAO"
      ? { status: "CATEGORIZADO_REUNIAO", reuniao_id: registroId }
      : { status: "CATEGORIZADO_ATIVIDADE", atividade_id: registroId };

  const { error } = await admin
    .from("outlook_eventos")
    .update({ ...patch, categorizado_em: new Date().toISOString() })
    .eq("id", eventoId);
  if (error) return { ok: false, error: "Erro ao vincular evento." };

  if (ev.outlook_event_id) {
    const tabela = tipo === "REUNIAO" ? "reunioes" : "atividades_internas";
    await admin
      .from(tabela)
      .update({ outlook_event_id: ev.outlook_event_id })
      .eq("id", registroId);
  }

  revalidateCalendario();
  return { ok: true };
}

export async function dismissAlertasLoginBanner(): Promise<void> {
  await clearAlertasLoginCookie();
}
