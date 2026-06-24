"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { reuniaoSchema, type ReuniaoFormValues } from "@/lib/validations";
import type { ReuniaoComRelacoes } from "@/types/database";
import { colaboradorIdPorEmail } from "@/lib/colaborador-email";
import { diffMinutos } from "@/lib/format";
import { datetimeLocalSpToIso } from "@/lib/datetime-br";
import { CALENDARIO_PATH } from "@/lib/calendario";
import {
  buscarGravacaoFellow,
  fellowConfigurado,
  FellowApiError,
} from "@/lib/fellow";
import {
  FELLOW_MSG_SEM_GRAVACAO,
  FELLOW_MSG_SEM_IA,
} from "@/lib/fellow-messages";

export type ActionResult = { ok: boolean; error?: string; id?: string };

const REUNIAO_DETALHE_SELECT =
  "*, cliente:pessoas(ci, nome, grupo_cliente), participantes:reuniao_participantes(colaborador_id, papel, nome, email, colaborador:colaboradores(id, nome, avatar_url, email, departamento, usuario_id))";

export type FellowImportResult = {
  ok: boolean;
  error?: string;
  motivo?: "sem_gravacao" | "sem_conteudo_ia" | "config" | "api" | "parcial";
  resultado?: string;
  proximos_passos?: string;
  titulo_fellow?: string | null;
  tem_resumo_ia?: boolean;
  tem_topicos_ia?: boolean;
};

function revalidateReunioes() {
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/clientes");
  revalidatePath("/relatorios");
  revalidatePath("/tarefas");
  revalidatePath("/proximos-passos");
}

function buildRow(values: ReuniaoFormValues) {
  const inicio = datetimeLocalSpToIso(values.data_hora_inicio)!;
  const fim = datetimeLocalSpToIso(values.data_hora_fim);
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
  return colaboradorIdPorEmail(supabase, u.email);
}

function adminOuErro(): ReturnType<typeof createAdminClient> | { error: string } {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor — necessária para salvar reuniões.",
    };
  }
  return createAdminClient();
}

async function assertPodeGerirReuniao(
  reuniaoId: string,
  pessoa: NonNullable<Awaited<ReturnType<typeof getPessoaAtual>>>
): Promise<string | null> {
  if (pessoa.is_admin) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reunioes")
    .select("criado_por_id")
    .eq("id", reuniaoId)
    .maybeSingle();

  if (!data) return "Reunião não encontrada.";
  if (data.criado_por_id !== pessoa.id) {
    return "Sem permissão para editar esta reunião.";
  }
  return null;
}

async function syncParticipantes(
  reuniaoId: string,
  participantes: string[],
  externos: { nome: string; email?: string }[],
  organizadorUsuarioId: string | null
): Promise<string | null> {
  const adminOrErr = adminOuErro();
  if ("error" in adminOrErr) return adminOrErr.error;
  const supabase = adminOrErr;
  const { error: delErr } = await supabase
    .from("reuniao_participantes")
    .delete()
    .eq("reuniao_id", reuniaoId);
  if (delErr) return "Erro ao salvar participantes da reunião.";

  const ids = new Set(participantes ?? []);
  const organizadorColabId = await colaboradorIdDoUsuario(
    supabase,
    organizadorUsuarioId
  );
  if (organizadorColabId) ids.add(organizadorColabId);

  const internoRows = Array.from(ids).map((colaboradorId) => ({
    reuniao_id: reuniaoId,
    colaborador_id: colaboradorId,
    papel:
      colaboradorId === organizadorColabId ? "ORGANIZADOR" : "PARTICIPANTE",
  }));

  // Externos (sem colaborador interno): identificados por nome, e-mail opcional.
  const vistos = new Set<string>();
  const externoRows = (externos ?? [])
    .map((p) => ({ nome: (p.nome ?? "").trim(), email: (p.email ?? "").trim() }))
    .filter((p) => p.nome || p.email)
    .filter((p) => {
      const chave = p.email
        ? p.email.toLowerCase()
        : `nome:${p.nome.toLowerCase()}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .map((p) => ({
      reuniao_id: reuniaoId,
      colaborador_id: null,
      nome: p.nome || p.email,
      email: p.email || null,
      papel: "PARTICIPANTE" as const,
    }));

  const rows = [...internoRows, ...externoRows];
  if (rows.length === 0) return null;

  const { error: insErr } = await supabase
    .from("reuniao_participantes")
    .insert(rows);
  if (insErr) return "Erro ao salvar participantes da reunião.";
  return null;
}

function mapReuniaoDbError(error: { message?: string; code?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("row-level security")) {
    return "Sem permissão para registrar a reunião. Contate o administrador.";
  }
  if (msg.includes("reunioes_cliente_id_fkey")) {
    return "Cliente inválido ou não encontrado na base.";
  }
  return "Erro ao salvar a reunião.";
}

export async function createReuniao(values: unknown): Promise<ActionResult> {
  const parsed = reuniaoSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const pessoa = await getPessoaAtual();
  if (!pessoa?.id) {
    return {
      ok: false,
      error: "Usuário não vinculado ao cadastro. Contate o administrador.",
    };
  }

  const adminOrErr = adminOuErro();
  if ("error" in adminOrErr) {
    return { ok: false, error: adminOrErr.error };
  }

  const { data, error } = await adminOrErr
    .from("reunioes")
    .insert({ ...buildRow(parsed.data), criado_por_id: pessoa.id })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: mapReuniaoDbError(error) };
  }

  const donoCalendarioId = parsed.data.dono_calendario_id?.trim() || null;
  const partErr = await syncParticipantes(
    data.id,
    parsed.data.participantes ?? [],
    parsed.data.participantes_externos ?? [],
    donoCalendarioId ?? pessoa.id
  );
  if (partErr) {
    return { ok: false, error: partErr };
  }

  revalidateReunioes();
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

  const pessoa = await getPessoaAtual();
  if (!pessoa?.id) {
    return {
      ok: false,
      error: "Usuário não vinculado ao cadastro. Contate o administrador.",
    };
  }

  const permErr = await assertPodeGerirReuniao(id, pessoa);
  if (permErr) return { ok: false, error: permErr };

  const adminOrErr = adminOuErro();
  if ("error" in adminOrErr) {
    return { ok: false, error: adminOrErr.error };
  }

  const { error } = await adminOrErr
    .from("reunioes")
    .update(buildRow(parsed.data))
    .eq("id", id);

  if (error) return { ok: false, error: mapReuniaoDbError(error) };

  const { data: org } = await adminOrErr
    .from("reuniao_participantes")
    .select("colaborador_id, colaborador:colaboradores(usuario_id)")
    .eq("reuniao_id", id)
    .eq("papel", "ORGANIZADOR")
    .maybeSingle();

  const orgUsuarioId =
    (org?.colaborador as { usuario_id?: string | null } | null)?.usuario_id ??
    null;

  const partErr = await syncParticipantes(
    id,
    parsed.data.participantes ?? [],
    parsed.data.participantes_externos ?? [],
    orgUsuarioId
  );
  if (partErr) return { ok: false, error: partErr };

  revalidateReunioes();
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
  const { data, error } = await supabase
    .from("reunioes")
    .update({
      status: "CANCELADA",
      motivo_cancelamento: motivo.trim(),
      cancelado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Erro ao cancelar." };
  if (!data?.length) {
    return { ok: false, error: "Sem permissão para cancelar esta reunião." };
  }
  revalidateReunioes();
  return { ok: true };
}

export async function mudarStatusReuniao(
  id: string,
  status: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reunioes")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Erro ao mudar status." };
  if (!data?.length) {
    return { ok: false, error: "Sem permissão para alterar esta reunião." };
  }
  revalidateReunioes();
  return { ok: true };
}

export async function deleteReuniao(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reunioes")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "Erro ao excluir." };
  if (!data?.length) {
    return { ok: false, error: "Sem permissão para excluir esta reunião." };
  }
  revalidateReunioes();
  return { ok: true };
}

export async function buscarReuniaoPorId(
  id: string
): Promise<ReuniaoComRelacoes | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reunioes")
    .select(REUNIAO_DETALHE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as ReuniaoComRelacoes;
}

export async function buscarConteudoFellow(input: {
  outlook_event_id?: string | null;
  titulo?: string | null;
  data_hora_inicio?: string | null;
}): Promise<FellowImportResult> {
  if (!fellowConfigurado()) {
    return {
      ok: false,
      motivo: "config",
      error: "Integração Fellow não configurada no servidor.",
    };
  }

  try {
    const resultado = await buscarGravacaoFellow(input);
    if (!resultado) {
      return {
        ok: false,
        motivo: "config",
        error: "Integração Fellow não configurada no servidor.",
      };
    }

    if (resultado.status === "sem_gravacao") {
      return {
        ok: false,
        motivo: "sem_gravacao",
        error: FELLOW_MSG_SEM_GRAVACAO,
      };
    }

    if (resultado.status === "sem_conteudo_ia") {
      return {
        ok: false,
        motivo: "sem_conteudo_ia",
        error: FELLOW_MSG_SEM_IA,
        titulo_fellow: resultado.tituloFellow,
      };
    }

    const conteudo = resultado.conteudo;
    return {
      ok: true,
      resultado: conteudo.resumo || undefined,
      proximos_passos: conteudo.proximos_passos || undefined,
      titulo_fellow: conteudo.tituloFellow,
      tem_resumo_ia: conteudo.temResumoIa,
      tem_topicos_ia: conteudo.temTopicosIa,
    };
  } catch (e) {
    if (e instanceof FellowApiError) {
      return { ok: false, motivo: "api", error: `Fellow: ${e.message}` };
    }
    return { ok: false, motivo: "api", error: "Erro ao consultar a API Fellow." };
  }
}

export async function importarFellowReuniao(id: string): Promise<FellowImportResult> {
  const supabase = await createClient();
  const { data: reuniao, error } = await supabase
    .from("reunioes")
    .select("id, titulo, outlook_event_id, data_hora_inicio, modalidade")
    .eq("id", id)
    .maybeSingle();

  if (error || !reuniao) {
    return { ok: false, error: "Reunião não encontrada." };
  }

  const resultado = await buscarConteudoFellow({
    outlook_event_id: reuniao.outlook_event_id,
    titulo: reuniao.titulo,
    data_hora_inicio: reuniao.data_hora_inicio,
  });
  if (!resultado.ok) return resultado;

  const patch: {
    resultado?: string | null;
    proximos_passos?: string | null;
  } = {};
  if (resultado.resultado?.trim()) patch.resultado = resultado.resultado.trim();
  if (resultado.proximos_passos?.trim()) {
    patch.proximos_passos = resultado.proximos_passos.trim();
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nenhum conteúdo Fellow para importar." };
  }

  const { error: upErr } = await supabase
    .from("reunioes")
    .update(patch)
    .eq("id", id);
  if (upErr) return { ok: false, error: "Erro ao salvar conteúdo importado." };

  revalidateReunioes();
  return resultado;
}
