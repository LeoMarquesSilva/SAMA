/** Chave exibida para grupo vazio (view resumo usa ''; empresas view usa null). */
export const GRUPO_SEM_NOME = "Sem grupo";

/** Resumo mínimo de cliente — sempre incluir grupo_cliente quando disponível. */
export type ClienteResumo = {
  ci: string;
  nome: string;
  grupo_cliente?: string | null;
  cpf_cnpj?: string | null;
};

/** Rótulo amigável para grupo_cliente vazio (VIOS). */
export function labelGrupoCliente(grupo: string | null | undefined) {
  const t = (grupo ?? "").trim();
  return t || GRUPO_SEM_NOME;
}

/** Chave interna do resumo (escritorio_grupos_resumo) para cadastros sem grupo. */
export function isGrupoSemNome(grupoCliente: string | null | undefined) {
  return !(grupoCliente ?? "").trim();
}

/** Subtítulo de cliente em buscas/seletores: grupo sempre primeiro. */
export function subtituloCliente(c: {
  grupo_cliente?: string | null;
  cpf_cnpj?: string | null;
}): string {
  const parts = [labelGrupoCliente(c.grupo_cliente)];
  const doc = (c.cpf_cnpj ?? "").trim();
  if (doc) parts.push(doc);
  return parts.join(" · ");
}

/** Nome + grupo para listagens (reuniões, relatórios, etc.). */
export function linhaCliente(c: {
  nome: string;
  grupo_cliente?: string | null;
}): string {
  return `${c.nome} · ${labelGrupoCliente(c.grupo_cliente)}`;
}
