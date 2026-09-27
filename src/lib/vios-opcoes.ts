"use client";

import { createClient } from "@/lib/supabase/client";

/** Opções reais do formulário de tarefa do VIOS para uma pasta/processo. */
export type OpcaoVios = { id: string; nome: string };

export type OpcoesPastaVios = {
  pasta_tipo: "Processo" | "Atendimento";
  pasta: string;
  ci_pasta: string | null;
  titulo: string | null;
  etapas: OpcaoVios[];
  etiquetas: OpcaoVios[];
  usuarios: OpcaoVios[];
  atualizado_em: string;
  fonte: "cache" | "vios";
};

/**
 * Busca no VIOS (via Edge Function vios-opcoes → robô) os tipos de tarefa,
 * etiquetas e responsáveis aceitos na pasta. Usa cache de 24 h no Supabase;
 * a primeira consulta de uma pasta leva ~15–30 s porque o robô abre o VIOS.
 */
export async function buscarOpcoesVios(
  pastaTipo: "Processo" | "Atendimento",
  pasta: string,
  atualizar = false
): Promise<OpcoesPastaVios> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("vios-opcoes", {
    body: { pasta_tipo: pastaTipo, pasta: pasta.trim(), atualizar },
  });
  if (error) {
    let msg = error.message || "Falha ao consultar o VIOS.";
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const corpo = (await ctx.json()) as { erro?: string };
        if (corpo?.erro) msg = corpo.erro;
      } catch {
        /* corpo não-JSON */
      }
    }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.erro ?? "Falha ao consultar o VIOS.");
  return data as OpcoesPastaVios;
}

/** Normaliza nomes para comparar (sem acento, caixa ou espaços extras). */
export function normalizarNome(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Acha o usuário do VIOS correspondente a um colaborador do SAMA:
 * nome igual; ou todas as palavras do SAMA contidas no nome do VIOS
 * (mesmo 1º e último nome), desde que só exista 1 candidato.
 */
export function usuarioViosDoColaborador(
  nomeColaborador: string | undefined,
  usuarios: OpcaoVios[]
): OpcaoVios | undefined {
  if (!nomeColaborador) return undefined;
  const alvo = normalizarNome(nomeColaborador);
  const exato = usuarios.filter((u) => normalizarNome(u.nome) === alvo);
  if (exato.length === 1) return exato[0];
  const pal = alvo.split(" ").filter(Boolean);
  if (pal.length < 2) return undefined;
  const cand = usuarios.filter((u) => {
    const v = normalizarNome(u.nome).split(" ");
    return (
      v[0] === pal[0] &&
      v[v.length - 1] === pal[pal.length - 1] &&
      pal.every((w) => v.includes(w))
    );
  });
  return cand.length === 1 ? cand[0] : undefined;
}
