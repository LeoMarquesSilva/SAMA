"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { getCalendarEvents, outlookConfigurado } from "@/lib/graph";
import { clearAlertasLoginCookie } from "@/lib/alertas-login";
import { CALENDARIO_PATH, calendarioSyncRange } from "@/lib/calendario";
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

function revalidateCalendario() {
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/outlook");
  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  revalidatePath("/proximos-passos");
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
 * - `escopo`: "todos" (admin) sincroniza todas as pessoas com e-mail;
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

  const supabase = await createClient();
  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;

  let pessoas: { id: string; email: string; nome: string }[] = [];
  if (escopo === "todos" && isAdmin) {
    const { data } = await supabase
      .from("usuarios")
      .select("id, email, nome")
      .not("email", "is", null);
    pessoas = data ?? [];
  } else if (eu) {
    pessoas = [{ id: eu.id, email: eu.email, nome: eu.nome }];
  }

  if (pessoas.length === 0) {
    return { ok: false, error: "Nenhuma pessoa com e-mail para sincronizar." };
  }

  const { start, end } = calendarioSyncRange();

  let importados = 0;
  let removidos = 0;
  let pessoasOk = 0;
  let pessoasErro = 0;
  const detalhes: string[] = [];

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : null;

  for (const p of pessoas) {
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
        const { error } = await supabase
          .from("outlook_eventos")
          .upsert(rows, {
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
      removidos += cleanup.removidos;

      importados += rows.length;
      pessoasOk += 1;
      await supabase.from("outlook_sync_logs").insert({
        pessoa_id: p.id,
        eventos_importados: rows.length,
        status: "SUCESSO",
      });
    } catch (err) {
      pessoasErro += 1;
      const msg = err instanceof Error ? err.message : "erro";
      detalhes.push(`${p.nome}: ${msg.slice(0, 120)}`);
      await supabase.from("outlook_sync_logs").insert({
        pessoa_id: p.id,
        eventos_importados: 0,
        status: "ERRO",
        mensagem_erro: msg.slice(0, 500),
      });
    }
  }

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
