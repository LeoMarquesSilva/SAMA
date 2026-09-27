import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { CasoAgendamentoVios } from "@/lib/vios-entrada";

/**
 * Fila de agendamentos do RPA (Supabase: public.vios_agendamentos).
 * O pg_cron → Edge Function disparar-rpa → sama-rpa (Easypanel) consome a fila
 * e cria a tarefa no VIOS. Resultado em status/resultado/erro da própria linha.
 */
export type CasoFilaVios = CasoAgendamentoVios & {
  pastaTipo: "Processo" | "Atendimento";
  colaboradorId: string;
  /** Nome exato do usuário no VIOS (tem prioridade sobre o colaborador). */
  responsavelVios?: string;
  tarefaId?: string;
  etiquetaId?: string;
  etiqueta?: string;
};

export async function enfileirarCasosVios(
  reuniaoId: string,
  criadoPorId: string | null,
  casos: CasoFilaVios[]
): Promise<{ id: string }[]> {
  if (casos.length === 0) throw new Error("Nenhum caso para enviar ao agendamento VIOS.");

  const admin = createAdminClient();

  const ids = [...new Set(casos.map((c) => c.colaboradorId).filter(Boolean))];
  const { data: colabs, error: colabErr } = ids.length
    ? await admin.from("colaboradores").select("id, nome, email").in("id", ids)
    : { data: [] as { id: string; nome: string; email: string | null }[], error: null };
  if (colabErr) throw new Error("Falha ao ler os responsáveis (colaboradores).");
  const porId = new Map((colabs ?? []).map((c) => [c.id, c]));

  const linhas = casos.map((c, i) => {
    const colab = porId.get(c.colaboradorId);
    const responsavel = c.responsavelVios?.trim() || colab?.nome;
    if (!responsavel) throw new Error(`Responsável do passo ${i + 1} não encontrado.`);
    return {
      reuniao_id: reuniaoId,
      criado_por_id: criadoPorId,
      tipo: c.tipo,
      tarefa: c.tarefa,
      observacao: c.observacao,
      data: c.data,
      pasta: c.pasta,
      pasta_tipo: c.pastaTipo,
      responsavel,
      responsavel_email: colab?.email ?? null,
      tarefa_id: c.tarefaId || null,
      etiqueta_id: c.etiquetaId || null,
      etiqueta: c.etiqueta || null,
      status: "pendente",
    };
  });

  const { data, error } = await admin
    .from("vios_agendamentos")
    .insert(linhas)
    .select("id");
  if (error) throw new Error(`Falha ao colocar na fila do VIOS: ${error.message}`);
  return data ?? [];
}
