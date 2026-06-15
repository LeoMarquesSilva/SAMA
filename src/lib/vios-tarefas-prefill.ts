import type {
  AtividadeInterna,
  ReuniaoComRelacoes,
  TipoAtividade,
  ViosTarefaRow,
} from "@/types/database";
import { tituloCompletoTarefa } from "@/lib/vios-tarefas-utils";
import { tipoAtividadePorTarefaPai } from "@/lib/vios-tarefas-tipo-map";

function parseHorario(horario: string | null): string {
  if (!horario) return "09:00";
  const m = horario.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "09:00";
  const h = parseInt(m[1], 10);
  const min = m[2];
  if (h === 0 && min === "00") return "09:00";
  return `${String(h).padStart(2, "0")}:${min}`;
}

/** Data/hora da conclusão VIOS (prioriza data/hora da conclusão). */
export function tarefaDataHoraConclusao(
  t: Pick<
    ViosTarefaRow,
    | "data_conclusao"
    | "data_limite"
    | "data_para_conclusao"
    | "hora_conclusao"
    | "horario"
  >
): string {
  const date = t.data_conclusao || t.data_limite || t.data_para_conclusao;
  if (!date) return "";
  const time = t.hora_conclusao
    ? parseHorario(t.hora_conclusao)
    : parseHorario(t.horario);
  return `${date}T${time}`;
}

/** Valor para datetime-local a partir da data/horário da tarefa VIOS. */
export function tarefaDataHoraLocal(t: ViosTarefaRow): string {
  const date = t.data_limite || t.data_para_conclusao;
  if (!date) return "";
  return `${date}T${parseHorario(t.horario)}`;
}

function inferTipo(t: ViosTarefaRow): TipoAtividade | undefined {
  return tipoAtividadePorTarefaPai(t) ?? undefined;
}

export function buildDescricaoTarefa(t: ViosTarefaRow): string {
  const parts: string[] = [];
  if (t.descricao?.trim()) parts.push(t.descricao.trim());

  const meta: string[] = [];
  if (t.nro_cnj) meta.push(`Processo: ${t.nro_cnj}`);
  if (t.pasta) meta.push(`Pasta: ${t.pasta}`);
  if (t.area_do_processo) meta.push(`Área: ${t.area_do_processo}`);
  if (t.objeto_do_processo) meta.push(`Objeto: ${t.objeto_do_processo}`);
  if (t.ci) meta.push(`CI tarefa VIOS: ${t.ci}`);
  if (meta.length) parts.push(meta.join("\n"));

  return parts.join("\n\n");
}

export function prefillAtividadeFromTarefa(
  t: ViosTarefaRow
): Partial<AtividadeInterna> {
  const inicio =
    tarefaDataHoraConclusao(t) || tarefaDataHoraLocal(t);
  const tipo = inferTipo(t);
  return {
    titulo: tituloCompletoTarefa(t),
    ...(tipo ? { tipo } : {}),
    status: t.data_conclusao || t.usuario_concluiu ? "REALIZADA" : undefined,
    data_hora_inicio: inicio,
    descricao: buildDescricaoTarefa(t) || null,
    tema: t.cliente ?? null,
    pessoa_id: t.usuario_id ?? undefined,
  };
}

export function prefillReuniaoFromTarefa(
  t: ViosTarefaRow
): Partial<ReuniaoComRelacoes> {
  const temaParts = [t.cliente, t.grupo_cliente, t.descricao?.slice(0, 200)]
    .filter(Boolean)
    .map((s) => String(s).trim());
  return {
    titulo: tituloCompletoTarefa(t),
    tipo: "GESTAO_OPERACIONAL",
    data_hora_inicio: tarefaDataHoraLocal(t),
    tema: temaParts.length ? temaParts.join(" — ") : null,
    ...(t.cliente
      ? {
          cliente: {
            nome: t.cliente,
            grupo_cliente: t.grupo_cliente ?? null,
          },
        }
      : {}),
  };
}
