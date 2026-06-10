"use server";

import { isGrupoSemNome } from "@/lib/clientes";
import { createClient } from "@/lib/supabase/server";
import type { EmpresaDoGrupo } from "@/types/database";

export type ClienteBusca = {
  ci: string;
  nome: string;
  cpf_cnpj: string | null;
  grupo_cliente: string | null;
};

/**
 * Empresas de um grupo (view escritorio_empresas_por_grupo), paginado.
 */
export async function listarEmpresasDoGrupo(
  grupoCliente: string,
  opts?: { q?: string; pagina?: number; porPagina?: number }
): Promise<{ empresas: EmpresaDoGrupo[]; total: number }> {
  const porPagina = opts?.porPagina ?? 50;
  const pagina = Math.max(1, opts?.pagina ?? 1);
  const q = (opts?.q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { empresas: [], total: 0 };

  let query = supabase
    .from("escritorio_empresas_por_grupo")
    .select("ci, nome, cpf_cnpj, categoria, qtd_processos", { count: "exact" })
    .order("nome")
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);

  // Resumo usa '' para "Sem grupo"; a view de empresas retorna null (espelho SIOE).
  query = isGrupoSemNome(grupoCliente)
    ? query.is("grupo_cliente", null)
    : query.eq("grupo_cliente", grupoCliente);

  if (q.length >= 2) {
    const safe = q.replace(/[,()]/g, " ").trim();
    const like = `%${safe}%`;
    query = query.or(`nome.ilike.${like},cpf_cnpj.ilike.${like}`);
  }

  const { data, count } = await query;
  return {
    empresas: (data as EmpresaDoGrupo[]) ?? [],
    total: count ?? 0,
  };
}

/** Retorna o CI quando o grupo tem exatamente uma empresa. */
export async function obterCiEmpresaUnicaDoGrupo(
  grupoCliente: string
): Promise<string | null> {
  const { empresas, total } = await listarEmpresasDoGrupo(grupoCliente, {
    porPagina: 1,
  });
  if (total !== 1 || !empresas[0]?.ci) return null;
  return empresas[0].ci;
}

/**
 * Busca clientes (espelho do VIOS) por nome, CNPJ ou grupo — para o seletor
 * de cliente da reunião. A tabela tem ~37k linhas, então a busca é sempre
 * server-side e limitada.
 */
export async function buscarClientes(q: string): Promise<ClienteBusca[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const safe = query.replace(/[,()]/g, " ").trim();
  const like = `%${safe}%`;

  const { data } = await supabase
    .from("pessoas")
    .select("ci, nome, cpf_cnpj, grupo_cliente")
    .or(`nome.ilike.${like},cpf_cnpj.ilike.${like},grupo_cliente.ilike.${like}`)
    .order("nome")
    .limit(20);

  return (data as ClienteBusca[]) ?? [];
}
