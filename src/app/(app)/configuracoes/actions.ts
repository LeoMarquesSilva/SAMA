"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CALENDARIO_PATH } from "@/lib/calendario";
import { chaveDoTipo, type TipoReuniaoItem } from "@/lib/reuniao-tipos";

export type ActionResult = { ok: boolean; error?: string };

const MSG_SEM_TABELA =
  "A tabela de tipos ainda não existe no banco. Aplique a migration 0047 e tente de novo.";

function erroAmigavel(error: { message?: string; code?: string } | null): string {
  const msg = error?.message ?? "";
  if (error?.code === "42P01") return MSG_SEM_TABELA;
  if (msg.includes("row-level security")) {
    return "Só administradores podem alterar os tipos de classificação.";
  }
  if (msg.includes("reuniao_tipos_pkey")) {
    return "Já existe um tipo com esse nome.";
  }
  if (msg.includes("reuniao_tipos_chave_formato")) {
    return "Use um nome com ao menos duas letras ou números.";
  }
  if (msg.includes("reunioes_tipo_fkey")) {
    return "Há reuniões classificadas com este tipo — desative-o em vez de excluir.";
  }
  return msg || "Não foi possível salvar o tipo.";
}

function revalidar() {
  revalidatePath("/configuracoes");
  revalidatePath(CALENDARIO_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/proximos-passos");
  revalidatePath("/clientes");
}

type Entrada = {
  label: string;
  descricao: string;
  ativo: boolean;
  grupo_interno: boolean;
  cor: string | null;
};

function validar(entrada: Entrada): string | null {
  if (entrada.label.trim().length < 2) {
    return "Informe o nome do tipo (ao menos dois caracteres).";
  }
  if (entrada.label.trim().length > 60) {
    return "O nome do tipo deve ter no máximo 60 caracteres.";
  }
  if (entrada.cor && !/^#[0-9a-fA-F]{6}$/.test(entrada.cor)) {
    return "Cor inválida.";
  }
  return null;
}

export async function criarTipoReuniao(entrada: Entrada): Promise<ActionResult> {
  await requireAdmin();
  const invalido = validar(entrada);
  if (invalido) return { ok: false, error: invalido };

  const label = entrada.label.trim();
  const chave = chaveDoTipo(label);
  if (chave.length < 2) {
    return { ok: false, error: "Use um nome com ao menos duas letras ou números." };
  }

  const supabase = await createClient();
  const { data: ordemMax, error: ordemErr } = await supabase
    .from("reuniao_tipos")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ordemErr) return { ok: false, error: erroAmigavel(ordemErr) };

  const { error } = await supabase.from("reuniao_tipos").insert({
    chave,
    label,
    descricao: entrada.descricao.trim(),
    ativo: entrada.ativo,
    grupo_interno: entrada.grupo_interno,
    cor: entrada.cor,
    ordem: (ordemMax?.ordem ?? 0) + 10,
  });
  if (error) return { ok: false, error: erroAmigavel(error) };

  revalidar();
  return { ok: true };
}

/** Altera nome, descrição e comportamento. A chave gravada nas reuniões não muda. */
export async function atualizarTipoReuniao(
  chave: string,
  entrada: Entrada
): Promise<ActionResult> {
  await requireAdmin();
  const invalido = validar(entrada);
  if (invalido) return { ok: false, error: invalido };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reuniao_tipos")
    .update({
      label: entrada.label.trim(),
      descricao: entrada.descricao.trim(),
      ativo: entrada.ativo,
      grupo_interno: entrada.grupo_interno,
      cor: entrada.cor,
    })
    .eq("chave", chave)
    .select("chave");
  if (error) return { ok: false, error: erroAmigavel(error) };
  if (!data?.length) return { ok: false, error: "Tipo não encontrado." };

  revalidar();
  return { ok: true };
}

/**
 * Exclui o tipo. Só vale para tipo sem nenhuma reunião: a FK de reunioes.tipo
 * barra o resto, para não ficar reunião órfã sem classificação.
 */
export async function excluirTipoReuniao(chave: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { count, error: contaErr } = await supabase
    .from("reunioes")
    .select("id", { count: "exact", head: true })
    .eq("tipo", chave);
  if (contaErr) return { ok: false, error: "Não foi possível conferir o uso do tipo." };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Há ${count} reunião(ões) com este tipo. Desative-o para parar de oferecê-lo, sem mexer no histórico.`,
    };
  }

  const { error } = await supabase.from("reuniao_tipos").delete().eq("chave", chave);
  if (error) return { ok: false, error: erroAmigavel(error) };

  revalidar();
  return { ok: true };
}

/** Sobe/desce o tipo na ordem do select, trocando a posição com o vizinho. */
export async function moverTipoReuniao(
  chave: string,
  direcao: "cima" | "baixo"
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reuniao_tipos")
    .select("chave, ordem")
    .order("ordem");
  if (error) return { ok: false, error: erroAmigavel(error) };

  const lista = data ?? [];
  const i = lista.findIndex((t) => t.chave === chave);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };

  const [a, b] = [lista[i], lista[j]];
  const { error: e1 } = await supabase
    .from("reuniao_tipos")
    .update({ ordem: b.ordem })
    .eq("chave", a.chave);
  const { error: e2 } = await supabase
    .from("reuniao_tipos")
    .update({ ordem: a.ordem })
    .eq("chave", b.chave);
  if (e1 || e2) return { ok: false, error: erroAmigavel(e1 ?? e2) };

  revalidar();
  return { ok: true };
}

/** Quantas reuniões usam cada tipo — para avisar antes de desativar/excluir. */
export async function contarUsoDosTipos(
  tipos: TipoReuniaoItem[]
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const uso: Record<string, number> = {};
  for (const t of tipos) {
    const { count } = await supabase
      .from("reunioes")
      .select("id", { count: "exact", head: true })
      .eq("tipo", t.chave);
    uso[t.chave] = count ?? 0;
  }
  return uso;
}

export async function salvarPastasAtendimento(
  linhas: { area: string; pasta: string }[]
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  for (const linha of linhas) {
    const area = linha.area.trim();
    const pasta = linha.pasta.replace(/\D/g, "");
    if (!area || area.length > 80) {
      return { ok: false, error: "Área inválida." };
    }
    if (!pasta) {
      const { error } = await supabase
        .from("reuniao_pastas_area")
        .delete()
        .eq("area", area);
      if (error) {
        if (error.code === "42P01") {
          return {
            ok: false,
            error: "A tabela de pastas ainda não existe. Aplique a migration 0051.",
          };
        }
        if (error.message.includes("row-level security")) {
          return { ok: false, error: "Só administradores podem alterar estas pastas." };
        }
        return { ok: false, error: error.message };
      }
      continue;
    }
    if (!/^[0-9]{1,12}$/.test(pasta)) {
      return { ok: false, error: `A pasta de ${area} deve ser o número do CI.` };
    }
    const { error } = await supabase
      .from("reuniao_pastas_area")
      .upsert({ area, pasta }, { onConflict: "area" });
    if (error) {
      if (error.code === "42P01") {
        return {
          ok: false,
          error: "A tabela de pastas ainda não existe. Aplique a migration 0051.",
        };
      }
      if (error.message.includes("row-level security")) {
        return { ok: false, error: "Só administradores podem alterar estas pastas." };
      }
      return { ok: false, error: error.message };
    }
  }

  revalidar();
  return { ok: true };
}
