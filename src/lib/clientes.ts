/** Chave exibida para grupo vazio (view resumo usa ''; empresas view usa null). */
export const GRUPO_SEM_NOME = "Sem grupo";

/** Rótulo amigável para grupo_cliente vazio (VIOS). */
export function labelGrupoCliente(grupo: string | null | undefined) {
  const t = (grupo ?? "").trim();
  return t || GRUPO_SEM_NOME;
}

/** Chave interna do resumo (escritorio_grupos_resumo) para cadastros sem grupo. */
export function isGrupoSemNome(grupoCliente: string | null | undefined) {
  return !(grupoCliente ?? "").trim();
}
