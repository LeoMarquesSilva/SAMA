"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { atividadeSchema, type AtividadeFormValues } from "@/lib/validations";
import { diffMinutos } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function toIso(local?: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildRow(values: AtividadeFormValues, pessoaId: string) {
  const duracao =
    values.duracao_minutos && values.duracao_minutos > 0
      ? values.duracao_minutos
      : diffMinutos(values.data_hora_inicio, values.data_hora_fim);

  return {
    titulo: values.titulo,
    tipo: values.tipo,
    status: values.status,
    data_hora_inicio: toIso(values.data_hora_inicio)!,
    data_hora_fim: toIso(values.data_hora_fim),
    duracao_minutos: duracao,
    pessoa_id: pessoaId,
    descricao: values.descricao || null,
    tema: values.tema || null,
    com_pessoa_nome: values.com_pessoa_nome || null,
    com_pessoa_id: values.com_pessoa_id ? values.com_pessoa_id : null,
    motivo_cancelamento:
      values.status === "CANCELADA" ? values.motivo_cancelamento || null : null,
  };
}

export async function createAtividade(
  values: unknown,
  pessoaIdOverride?: string
): Promise<ActionResult> {
  const parsed = atividadeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const pessoa = await getPessoaAtual();
  const pessoaId = pessoaIdOverride || pessoa?.id;
  if (!pessoaId) {
    return {
      ok: false,
      error: "Não foi possível identificar a pessoa responsável.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atividades_internas")
    .insert(buildRow(parsed.data, pessoaId))
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Erro ao salvar atividade." };

  revalidatePath("/atividades");
  revalidatePath("/timesheet");
  return { ok: true, id: data.id };
}

export async function updateAtividade(
  id: string,
  values: unknown,
  pessoaIdOverride?: string
): Promise<ActionResult> {
  const parsed = atividadeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  // Mantém a pessoa responsável atual, salvo override explícito.
  let pessoaId = pessoaIdOverride;
  if (!pessoaId) {
    const { data: atual } = await supabase
      .from("atividades_internas")
      .select("pessoa_id")
      .eq("id", id)
      .single();
    pessoaId = atual?.pessoa_id;
  }
  if (!pessoaId) return { ok: false, error: "Pessoa responsável não encontrada." };

  const { error } = await supabase
    .from("atividades_internas")
    .update(buildRow(parsed.data, pessoaId))
    .eq("id", id);

  if (error) return { ok: false, error: "Erro ao atualizar atividade." };

  revalidatePath("/atividades");
  revalidatePath("/timesheet");
  return { ok: true, id };
}

export async function deleteAtividade(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("atividades_internas")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao excluir atividade." };
  revalidatePath("/atividades");
  revalidatePath("/timesheet");
  return { ok: true };
}
