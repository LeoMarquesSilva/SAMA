import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { TAREFA_COMPROMISSO_REUNIAO } from "@/lib/vios-agendamento";

/**
 * Prorrogação no VIOS: quando a data muda no SAMA depois do agendamento, a fila
 * ganha uma linha `operacao = 'prorrogar'` ligada à criação (`origem_id`) e o
 * robô muda a data da tarefa que já existe (supabase/migrations/0054).
 */

const DATA_BR_RE = /^\d{2}\/\d{2}\/\d{4}$/;

export type ResultadoProrrogacao =
  | { ok: true; acao: "sem_mudanca" | "data_ajustada" | "na_fila" | "fila_cancelada" }
  | { ok: false; error: string };

type LinhaFila = {
  id: string;
  operacao: string;
  status: string;
  data: string;
  origem_id: string | null;
  atualizado_em: string;
};

/** "YYYY-MM-DD..." (data local de São Paulo) → "DD/MM/AAAA". */
export function dataBrDoLocal(local: string | null | undefined): string | null {
  const m = (local ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/**
 * Pede para o robô mudar a data da tarefa criada pela linha `origemId`.
 * - Criação ainda na fila (pendente): só troca a data dela.
 * - Já existe prorrogação esperando: troca a data dela (ou a apaga, se voltou
 *   para a data que o VIOS já tem).
 * - Senão, enfileira uma prorrogação nova.
 */
export async function pedirProrrogacaoVios(
  origemId: string,
  novaData: string,
  criadoPorId: string | null,
  tentativa = 1
): Promise<ResultadoProrrogacao> {
  if (!DATA_BR_RE.test(novaData)) return { ok: false, error: "Data inválida (use DD/MM/AAAA)." };
  const admin = createAdminClient();

  const { data: origem, error } = await admin
    .from("vios_agendamentos")
    .select(
      "id, operacao, status, data, reuniao_id, tipo, tarefa, observacao, pasta, pasta_tipo, responsavel, responsavel_email, passo_texto, ci_pasta"
    )
    .eq("id", origemId)
    .maybeSingle();
  if (error || !origem) return { ok: false, error: "Agendamento não encontrado." };
  if (origem.operacao !== "criar") return { ok: false, error: "Agendamento inválido para prorrogar." };
  if (origem.status === "erro") {
    return { ok: false, error: "A criação desta tarefa no VIOS falhou; não há data para prorrogar." };
  }

  // O robô ainda não pegou a criação: basta criar já com a data nova.
  if (origem.status === "pendente") {
    if (origem.data === novaData) return { ok: true, acao: "sem_mudanca" };
    const { data: alterada } = await admin
      .from("vios_agendamentos")
      .update({ data: novaData })
      .eq("id", origem.id)
      .eq("status", "pendente")
      .select("id");
    if (alterada?.length) return { ok: true, acao: "data_ajustada" };
    // O robô pegou a criação neste meio-tempo: segue como prorrogação.
  }

  const { data: prorrogacoes } = await admin
    .from("vios_agendamentos")
    .select("id, operacao, status, data, origem_id, atualizado_em")
    .eq("origem_id", origem.id)
    .eq("operacao", "prorrogar")
    .order("criado_em", { ascending: false });
  const lista = (prorrogacoes ?? []) as LinhaFila[];

  // Data que o VIOS tem (ou terá) sem contar a prorrogação que ainda espera.
  const emAndamento = lista.find((p) => p.status === "enviado" || p.status === "processando");
  const ultimaConcluida = lista
    .filter((p) => p.status === "concluido")
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em))[0];
  const dataNoVios = emAndamento?.data ?? ultimaConcluida?.data ?? origem.data;
  const esperando = lista.find((p) => p.status === "pendente");

  if (esperando) {
    if (novaData === dataNoVios) {
      await admin.from("vios_agendamentos").delete().eq("id", esperando.id).eq("status", "pendente");
      return { ok: true, acao: "fila_cancelada" };
    }
    if (esperando.data === novaData) return { ok: true, acao: "sem_mudanca" };
    const { data: alterada } = await admin
      .from("vios_agendamentos")
      .update({ data: novaData })
      .eq("id", esperando.id)
      .eq("status", "pendente")
      .select("id");
    if (alterada?.length) return { ok: true, acao: "na_fila" };
  } else if (novaData === dataNoVios) {
    return { ok: true, acao: "sem_mudanca" };
  }

  const { error: insertErr } = await admin.from("vios_agendamentos").insert({
    operacao: "prorrogar",
    origem_id: origem.id,
    reuniao_id: origem.reuniao_id,
    criado_por_id: criadoPorId,
    tipo: origem.tipo,
    tarefa: origem.tarefa,
    observacao: origem.observacao,
    pasta: origem.pasta,
    pasta_tipo: origem.pasta_tipo,
    responsavel: origem.responsavel,
    responsavel_email: origem.responsavel_email,
    passo_texto: origem.passo_texto,
    ci_pasta: origem.ci_pasta,
    data: novaData,
    status: "pendente",
  });
  if (insertErr) {
    // Outra gravação criou a prorrogação pendente ao mesmo tempo: atualiza a dela.
    if (insertErr.code === "23505" && tentativa === 1) {
      return pedirProrrogacaoVios(origemId, novaData, criadoPorId, 2);
    }
    console.error("[prorrogar] falha ao enfileirar:", insertErr.message);
    return { ok: false, error: "Não foi possível pedir a nova data ao VIOS." };
  }
  return { ok: true, acao: "na_fila" };
}

/**
 * A data da reunião mudou no SAMA: leva a nova data aos compromissos
 * (REUNIÃO / ATENDIMENTO AO CLIENTE) que o agendamento criou no VIOS.
 * Sem compromisso, ou com a mesma data, não faz nada.
 */
export async function prorrogarCompromissosDaReuniao(
  reuniaoId: string,
  inicioLocal: string,
  criadoPorId: string | null
): Promise<void> {
  const novaData = dataBrDoLocal(inicioLocal);
  if (!novaData) return;
  const admin = createAdminClient();
  const { data: compromissos } = await admin
    .from("vios_agendamentos")
    .select("id")
    .eq("reuniao_id", reuniaoId)
    .eq("operacao", "criar")
    .eq("tarefa", TAREFA_COMPROMISSO_REUNIAO)
    .neq("status", "erro");
  for (const c of compromissos ?? []) {
    const r = await pedirProrrogacaoVios(c.id, novaData, criadoPorId);
    if (!r.ok) console.error(`[prorrogar] compromisso ${c.id}:`, r.error);
  }
}
