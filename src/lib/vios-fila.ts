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
  /** Texto original do item de "Próximos passos". */
  textoChecklist?: string;
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

  // O responsável do VIOS pode não ser o colaborador do passo (ex.: o revisor do
  // prazo). Nesse caso o e-mail vem do nome, não do colaborador original.
  const nomesVios = [
    ...new Set(casos.map((c) => c.responsavelVios?.trim()).filter(Boolean)),
  ] as string[];
  const { data: porNomeRows } = nomesVios.length
    ? await admin.from("colaboradores").select("nome, email").in("nome", nomesVios)
    : { data: [] as { nome: string; email: string | null }[] };
  const emailPorNome = new Map(
    (porNomeRows ?? []).map((c) => [c.nome.trim().toLowerCase(), c.email])
  );

  const linhas = casos.map((c, i) => {
    const colab = porId.get(c.colaboradorId);
    const viosNome = c.responsavelVios?.trim();
    const responsavel = viosNome || colab?.nome;
    if (!responsavel) throw new Error(`Responsável do passo ${i + 1} não encontrado.`);
    const email = viosNome
      ? (emailPorNome.get(viosNome.toLowerCase()) ??
        (colab?.nome?.trim().toLowerCase() === viosNome.toLowerCase()
          ? colab?.email
          : null) ??
        null)
      : (colab?.email ?? null);
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
      responsavel_email: email,
      tarefa_id: c.tarefaId || null,
      etiqueta_id: c.etiquetaId || null,
      etiqueta: c.etiqueta || null,
      passo_texto: c.textoChecklist?.trim() || c.observacao,
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
