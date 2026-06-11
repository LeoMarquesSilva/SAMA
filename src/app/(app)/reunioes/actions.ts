"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { reuniaoSchema, type ReuniaoFormValues } from "@/lib/validations";
import { diffMinutos } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function toIso(local?: string | null): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildRow(values: ReuniaoFormValues) {
  const inicio = toIso(values.data_hora_inicio)!;
  const fim = toIso(values.data_hora_fim);
  const duracao =
    values.duracao_minutos && values.duracao_minutos > 0
      ? values.duracao_minutos
      : diffMinutos(values.data_hora_inicio, values.data_hora_fim);

  return {
    titulo: values.titulo,
    tipo: values.tipo,
    modalidade: values.modalidade,
    status: values.status,
    data_hora_inicio: inicio,
    data_hora_fim: fim,
    duracao_minutos: duracao,
    cliente_id: values.cliente_id ? values.cliente_id : null,
    link_online: values.link_online || null,
    local: values.local || null,
    tema: values.tema || null,
    objetivos: values.objetivos || null,
    resultado: values.resultado || null,
    proximos_passos: values.proximos_passos || null,
    gravacao_url: values.gravacao_url || null,
    ata_texto: values.ata_texto || null,
    motivo_cancelamento:
      values.status === "CANCELADA" ? values.motivo_cancelamento || null : null,
    cancelado_em: values.status === "CANCELADA" ? new Date().toISOString() : null,
  };
}

async function colaboradorIdDoUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string | null
) {
  if (!usuarioId) return null;
  const { data: u } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", usuarioId)
    .maybeSingle();
  if (!u?.email) return null;
  const { data: c } = await supabase
    .from("colaboradores")
    .select("id")
    .ilike("email", u.email)
    .maybeSingle();
  return c?.id ?? null;
}

async function syncParticipantes(
  reuniaoId: string,
  participantes: string[],
  organizadorUsuarioId: string | null
) {
  const supabase = await createClient();
  await supabase
    .from("reuniao_participantes")
    .delete()
    .eq("reuniao_id", reuniaoId);

  const ids = new Set(participantes ?? []);
  const organizadorColabId = await colaboradorIdDoUsuario(
    supabase,
    organizadorUsuarioId
  );
  if (organizadorColabId) ids.add(organizadorColabId);
  if (ids.size === 0) return;

  const rows = Array.from(ids).map((colaboradorId) => ({
    reuniao_id: reuniaoId,
    colaborador_id: colaboradorId,
    papel:
      colaboradorId === organizadorColabId ? "ORGANIZADOR" : "PARTICIPANTE",
  }));
  await supabase.from("reuniao_participantes").insert(rows);
}

export async function createReuniao(values: unknown): Promise<ActionResult> {
  const parsed = reuniaoSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const pessoa = await getPessoaAtual();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reunioes")
    .insert({ ...buildRow(parsed.data), criado_por_id: pessoa?.id ?? null })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Erro ao salvar a reunião." };
  }

  await syncParticipantes(
    data.id,
    parsed.data.participantes ?? [],
    pessoa?.id ?? null
  );

  revalidatePath("/reunioes");
  return { ok: true, id: data.id };
}

export async function updateReuniao(
  id: string,
  values: unknown
): Promise<ActionResult> {
  const parsed = reuniaoSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reunioes")
    .update(buildRow(parsed.data))
    .eq("id", id);

  if (error) return { ok: false, error: "Erro ao atualizar a reunião." };

  // Preserva o organizador atual (não força o editor como organizador).
  const { data: org } = await supabase
    .from("reuniao_participantes")
    .select("colaborador_id, colaborador:colaboradores(usuario_id)")
    .eq("reuniao_id", id)
    .eq("papel", "ORGANIZADOR")
    .maybeSingle();

  const orgUsuarioId =
    (org?.colaborador as { usuario_id?: string | null } | null)?.usuario_id ??
    null;

  await syncParticipantes(id, parsed.data.participantes ?? [], orgUsuarioId);

  revalidatePath("/reunioes");
  return { ok: true, id };
}

export async function cancelarReuniao(
  id: string,
  motivo: string
): Promise<ActionResult> {
  if (!motivo.trim()) {
    return { ok: false, error: "Informe o motivo do cancelamento." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("reunioes")
    .update({
      status: "CANCELADA",
      motivo_cancelamento: motivo.trim(),
      cancelado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao cancelar." };
  revalidatePath("/reunioes");
  return { ok: true };
}

export async function mudarStatusReuniao(
  id: string,
  status: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reunioes")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: "Erro ao mudar status." };
  revalidatePath("/reunioes");
  return { ok: true };
}

export async function deleteReuniao(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("reunioes").delete().eq("id", id);
  if (error) return { ok: false, error: "Erro ao excluir." };
  revalidatePath("/reunioes");
  return { ok: true };
}
