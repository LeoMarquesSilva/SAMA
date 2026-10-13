import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { TAREFA_COMPROMISSO_REUNIAO } from "@/lib/vios-agendamento";

/**
 * Cancelamento no VIOS: reunião cancelada no SAMA cancela o compromisso
 * "REUNIÃO / ATENDIMENTO AO CLIENTE" que o agendamento criou na agenda de cada
 * responsável. A fila ganha uma linha `operacao = 'cancelar'` ligada à criação
 * (supabase/migrations/0055); o robô cancela pela tela pxe/pxe-cancelar.php.
 * Próximos passos não são cancelados. Reabrir a reunião não reabre a tarefa.
 */

export type ResultadoCancelamento =
  | { ok: true; acao: "tirado_da_fila" | "ja_pedido" | "ja_encerrada" | "sem_tarefa" | "na_fila" }
  | { ok: false; error: string };

function normalizar(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

/**
 * Pede ao robô para cancelar no VIOS a tarefa criada pela linha `origemId`.
 * O motivo do cancelamento da reunião vai no campo Motivo do VIOS; na linha
 * da fila ele fica em `observacao`.
 */
export async function pedirCancelamentoVios(
  origemId: string,
  criadoPorId: string | null,
  motivo: string | null = null
): Promise<ResultadoCancelamento> {
  const admin = createAdminClient();
  const { data: origem, error } = await admin
    .from("vios_agendamentos")
    .select(
      "id, operacao, status, data, reuniao_id, tipo, tarefa, observacao, pasta, pasta_tipo, responsavel, responsavel_email, passo_texto, ci_pasta, resultado"
    )
    .eq("id", origemId)
    .maybeSingle();
  if (error || !origem || origem.operacao !== "criar") return { ok: false, error: "Agendamento não encontrado." };
  if (origem.status === "erro") return { ok: true, acao: "sem_tarefa" };

  // Ainda não foi para o VIOS: basta tirar da fila.
  if (origem.status === "pendente") {
    const { data: removida } = await admin
      .from("vios_agendamentos")
      .delete()
      .eq("id", origem.id)
      .eq("status", "pendente")
      .select("id");
    if (removida?.length) return { ok: true, acao: "tirado_da_fila" };
    // O robô pegou a criação neste meio-tempo: segue como cancelamento.
  }

  const { data: ativo } = await admin
    .from("vios_agendamentos")
    .select("id")
    .eq("origem_id", origem.id)
    .eq("operacao", "cancelar")
    .neq("status", "erro")
    .limit(1);
  if (ativo?.length) return { ok: true, acao: "ja_pedido" };

  // Já encerrada no VIOS (pelo espelho vios_tarefas): nada a fazer.
  const ci = (origem.resultado as { ci_vios?: string | number | null } | null)?.ci_vios;
  if (ci != null && ci !== "") {
    const { data: tarefa } = await admin
      .from("vios_tarefas")
      .select("vios_status")
      .eq("ci", String(ci))
      .maybeSingle();
    const status = normalizar(tarefa?.vios_status);
    if (status.startsWith("cancel") || status.startsWith("conclu")) return { ok: true, acao: "ja_encerrada" };
  }

  // Mudança de data que ainda não saiu perde o sentido.
  await admin
    .from("vios_agendamentos")
    .delete()
    .eq("origem_id", origem.id)
    .eq("operacao", "prorrogar")
    .eq("status", "pendente");

  const { error: insertErr } = await admin.from("vios_agendamentos").insert({
    operacao: "cancelar",
    origem_id: origem.id,
    reuniao_id: origem.reuniao_id,
    criado_por_id: criadoPorId,
    tipo: origem.tipo,
    tarefa: origem.tarefa,
    observacao: (motivo ?? "").trim().slice(0, 2000),
    pasta: origem.pasta,
    pasta_tipo: origem.pasta_tipo,
    responsavel: origem.responsavel,
    responsavel_email: origem.responsavel_email,
    passo_texto: origem.passo_texto,
    ci_pasta: origem.ci_pasta,
    data: origem.data,
    status: "pendente",
  });
  if (insertErr) {
    // Outra gravação pediu o mesmo cancelamento ao mesmo tempo.
    if (insertErr.code === "23505") return { ok: true, acao: "ja_pedido" };
    console.error("[cancelar] falha ao enfileirar:", insertErr.message);
    return { ok: false, error: "Não foi possível pedir o cancelamento no VIOS." };
  }
  return { ok: true, acao: "na_fila" };
}

/**
 * A reunião foi cancelada no SAMA: cancela no VIOS os compromissos
 * (REUNIÃO / ATENDIMENTO AO CLIENTE) da agenda de cada responsável.
 */
export async function cancelarCompromissosDaReuniao(
  reuniaoId: string,
  criadoPorId: string | null,
  motivo: string | null = null
): Promise<void> {
  const admin = createAdminClient();
  const { data: compromissos } = await admin
    .from("vios_agendamentos")
    .select("id")
    .eq("reuniao_id", reuniaoId)
    .eq("operacao", "criar")
    .eq("tarefa", TAREFA_COMPROMISSO_REUNIAO)
    .neq("status", "erro");
  for (const c of compromissos ?? []) {
    const r = await pedirCancelamentoVios(c.id, criadoPorId, motivo);
    if (!r.ok) console.error(`[cancelar] compromisso ${c.id}:`, r.error);
  }
}
