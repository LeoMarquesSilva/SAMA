import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoAtividade, ViosTarefaRow } from "@/types/database";
import {
  buildDescricaoTarefa,
  prefillAtividadeFromTarefa,
  tarefaDataHoraConclusao,
} from "@/lib/vios-tarefas-prefill";
import { tituloCompletoTarefa } from "@/lib/vios-tarefas-utils";
import {
  TIPOS_ATIVIDADE_AUTO_VIOS,
  tipoAtividadePorTarefaPai,
} from "@/lib/vios-tarefas-tipo-map";

import { datetimeLocalSpToIso } from "@/lib/datetime-br";

export function inferTarefaAutoTipo(t: {
  tarefa_pai?: string | null;
  tarefa?: string | null;
}): TipoAtividade | null {
  return tipoAtividadePorTarefaPai(t);
}

export function buildAtividadeAutoRow(t: ViosTarefaRow, tipo: TipoAtividade) {
  const pessoaId = t.usuario_concluiu_id ?? t.usuario_id;
  if (!pessoaId) return null;

  const inicioLocal = tarefaDataHoraConclusao(t);
  const prefill = prefillAtividadeFromTarefa(t);

  return {
    titulo: tituloCompletoTarefa(t),
    tipo,
    status: "REALIZADA" as const,
    data_hora_inicio:
      datetimeLocalSpToIso(
        inicioLocal || prefill.data_hora_inicio || new Date().toISOString()
      ) ?? new Date().toISOString(),
    data_hora_fim: null,
    duracao_minutos: null,
    pessoa_id: pessoaId,
    descricao: buildDescricaoTarefa(t) || null,
    tema: t.cliente ?? null,
    com_pessoa_nome: null,
    com_pessoa_id: null,
    motivo_cancelamento: null,
  };
}

export type AutoClassificacaoResult = {
  classificadas: Partial<Record<TipoAtividade, number>>;
  erros: number;
};

/** Cria atividades e marca tarefas VIOS mapeadas por tarefa pai. */
export async function autoClassificarTarefasAutomaticas(
  supabase: SupabaseClient,
  opts?: { cis?: string[] }
): Promise<AutoClassificacaoResult> {
  let query = supabase
    .from("vios_tarefas")
    .select("*")
    .eq("status", "PENDENTE")
    .is("atividade_id", null);

  if (opts?.cis?.length) query = query.in("ci", opts.cis);

  const { data: tarefas, error } = await query;
  if (error || !tarefas?.length) {
    return { classificadas: {}, erros: 0 };
  }

  const alvo = (tarefas as ViosTarefaRow[]).filter(
    (t) => inferTarefaAutoTipo(t) && (t.usuario_concluiu_id || t.usuario_id)
  );

  const classificadas: Partial<Record<TipoAtividade, number>> = {};
  let erros = 0;
  const agora = new Date().toISOString();

  for (const t of alvo) {
    const tipo = inferTarefaAutoTipo(t);
    if (!tipo || !TIPOS_ATIVIDADE_AUTO_VIOS.includes(tipo)) {
      erros++;
      continue;
    }

    const row = buildAtividadeAutoRow(t, tipo);
    if (!row) {
      erros++;
      continue;
    }

    const { data: atv, error: insErr } = await supabase
      .from("atividades_internas")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !atv) {
      erros++;
      continue;
    }

    const { error: updErr } = await supabase
      .from("vios_tarefas")
      .update({
        status: "CATEGORIZADO_ATIVIDADE",
        atividade_id: atv.id,
        categorizado_em: agora,
      })
      .eq("id", t.id);

    if (updErr) {
      erros++;
      continue;
    }

    classificadas[tipo] = (classificadas[tipo] ?? 0) + 1;
  }

  return { classificadas, erros };
}

/** @deprecated Use autoClassificarTarefasAutomaticas */
export async function autoClassificarTarefasCienciaNf(
  supabase: SupabaseClient,
  opts?: { cis?: string[] }
): Promise<{ criadas: number; erros: number }> {
  const r = await autoClassificarTarefasAutomaticas(supabase, opts);
  return {
    criadas: r.classificadas.CIENCIA_NF ?? 0,
    erros: r.erros,
  };
}
