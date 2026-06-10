"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { getCalendarEvents, outlookConfigurado } from "@/lib/graph";
import { CALENDARIO_PATH } from "@/lib/calendario";

export type ActionResult = { ok: boolean; error?: string };
export type SyncResult = {
  ok: boolean;
  error?: string;
  importados?: number;
  pessoasOk?: number;
  pessoasErro?: number;
  detalhes?: string[];
};

function revalidateCalendario() {
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/outlook");
  revalidatePath("/dashboard");
  revalidatePath("/reunioes");
  revalidatePath("/atividades");
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
 * - janela: de hoje-`atras` dias até hoje+`frente` dias.
 */
export async function sincronizarOutlook(
  escopo: "eu" | "todos" = "eu",
  atras = 7,
  frente = 30
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

  const start = new Date(Date.now() - atras * 86400000).toISOString();
  const end = new Date(Date.now() + frente * 86400000).toISOString();

  let importados = 0;
  let pessoasOk = 0;
  let pessoasErro = 0;
  const detalhes: string[] = [];

  for (const p of pessoas) {
    try {
      const eventos = await getCalendarEvents(p.email, start, end);
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
            ignoreDuplicates: true,
          });
        if (error) throw new Error(error.message);
      }

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

  revalidateCalendario();
  return { ok: true, importados, pessoasOk, pessoasErro, detalhes };
}

export async function ignorarEvento(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("outlook_eventos")
    .update({ status: "IGNORADO", categorizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao ignorar evento." };
  revalidateCalendario();
  return { ok: true };
}

export async function reverterEvento(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("outlook_eventos")
    .update({ status: "PENDENTE", categorizado_em: null })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao reverter evento." };
  revalidateCalendario();
  return { ok: true };
}

/** Vincula um evento do calendário a uma reunião/atividade já criada. */
export async function vincularCategorizado(
  eventoId: string,
  tipo: "REUNIAO" | "ATIVIDADE",
  registroId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch =
    tipo === "REUNIAO"
      ? { status: "CATEGORIZADO_REUNIAO", reuniao_id: registroId }
      : { status: "CATEGORIZADO_ATIVIDADE", atividade_id: registroId };

  const { error } = await supabase
    .from("outlook_eventos")
    .update({ ...patch, categorizado_em: new Date().toISOString() })
    .eq("id", eventoId);
  if (error) return { ok: false, error: "Erro ao vincular evento." };

  const { data: ev } = await supabase
    .from("outlook_eventos")
    .select("outlook_event_id")
    .eq("id", eventoId)
    .single();
  if (ev?.outlook_event_id) {
    const tabela = tipo === "REUNIAO" ? "reunioes" : "atividades_internas";
    await supabase
      .from(tabela)
      .update({ outlook_event_id: ev.outlook_event_id })
      .eq("id", registroId);
  }

  revalidateCalendario();
  return { ok: true };
}
