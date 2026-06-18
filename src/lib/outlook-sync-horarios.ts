import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Propaga início/fim/duração do Outlook para reuniões e atividades já categorizadas.
 * Mantém registros alinhados após cada re-sync.
 */
export async function alinharRegistrosComOutlook(
  supabase: SupabaseClient
): Promise<{ reunioes: number; atividades: number }> {
  const { data, error } = await supabase
    .from("outlook_eventos")
    .select(
      "reuniao_id, atividade_id, inicio, fim, duracao_minutos, status"
    )
    .in("status", ["CATEGORIZADO_REUNIAO", "CATEGORIZADO_ATIVIDADE"])
    .not("inicio", "is", null);

  if (error || !data?.length) {
    return { reunioes: 0, atividades: 0 };
  }

  let reunioes = 0;
  let atividades = 0;

  for (const oe of data) {
    if (oe.reuniao_id) {
      const { data: updated, error: upErr } = await supabase
        .from("reunioes")
        .update({
          data_hora_inicio: oe.inicio,
          data_hora_fim: oe.fim,
          duracao_minutos: oe.duracao_minutos,
        })
        .eq("id", oe.reuniao_id)
        .select("id");

      if (!upErr && updated?.length) reunioes += updated.length;
    }

    if (oe.atividade_id) {
      const { data: updated, error: upErr } = await supabase
        .from("atividades_internas")
        .update({
          data_hora_inicio: oe.inicio,
          data_hora_fim: oe.fim,
          duracao_minutos: oe.duracao_minutos,
        })
        .eq("id", oe.atividade_id)
        .select("id");

      if (!upErr && updated?.length) atividades += updated.length;
    }
  }

  return { reunioes, atividades };
}
