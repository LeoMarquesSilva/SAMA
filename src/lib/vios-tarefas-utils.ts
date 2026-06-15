/** Utilitários de tarefas VIOS — seguros para client e server (sem server-only). */

export type UsuarioNomeRef = { id: string; nome: string };

/** VIOS envia responsaveis como objeto { "ci": "Nome" } ou array de strings. */
export function normalizeNomeLista(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && "nome" in item) {
          return String((item as { nome?: string }).nome ?? "").trim();
        }
        return String(item ?? "").trim();
      })
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const s = value.trim();
    return s ? [s] : [];
  }
  return [];
}

export function normalizeNomeCompare(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * VIOS costuma trazer nome completo ("Leonardo Marques Silva") enquanto o SAMA
 * pode ter forma abreviada ("Leonardo Marques").
 */
export function nomesCorrespondem(
  nomeVios: string,
  nomeUsuario: string
): boolean {
  const a = normalizeNomeCompare(nomeVios);
  const b = normalizeNomeCompare(nomeUsuario);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(`${b} `) || b.startsWith(`${a} `)) return true;

  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  const [shorter, longer] =
    tokensA.length <= tokensB.length
      ? [tokensA, tokensB]
      : [tokensB, tokensA];

  if (shorter.length >= 2 && shorter.every((token) => longer.includes(token))) {
    return true;
  }

  return false;
}

export function findUsuarioPorNomeVios(
  nomeVios: string,
  usuarios: UsuarioNomeRef[]
): UsuarioNomeRef | null {
  const alvo = nomeVios.trim();
  if (!alvo) return null;
  return usuarios.find((u) => nomesCorrespondem(alvo, u.nome)) ?? null;
}

export function tarefaEnvolveUsuario(
  t: { responsaveis?: unknown; auxiliares?: unknown },
  nomeUsuario: string
): boolean {
  if (!nomeUsuario.trim()) return false;
  const nomes = [
    ...normalizeNomeLista(t.responsaveis),
    ...normalizeNomeLista(t.auxiliares),
  ];
  return nomes.some((n) => nomesCorrespondem(n, nomeUsuario));
}

export function tarefaEnvolveUsuarioId(
  t: {
    usuario_id?: string | null;
    responsaveis?: unknown;
    auxiliares?: unknown;
  },
  usuario: UsuarioNomeRef
): boolean {
  if (t.usuario_id === usuario.id) return true;
  return tarefaEnvolveUsuario(t, usuario.nome);
}

export function resolveUsuarioIdFromNomes(
  nomes: string[],
  usuarios: UsuarioNomeRef[]
): string | null {
  for (const nome of nomes) {
    const u = findUsuarioPorNomeVios(nome, usuarios);
    if (u) return u.id;
  }
  return null;
}

export function resolveConcluidorSocioAreaId(
  usuarioConcluiu: string | null | undefined,
  sociosArea: UsuarioNomeRef[]
): string | null {
  if (!usuarioConcluiu?.trim()) return null;
  return findUsuarioPorNomeVios(usuarioConcluiu, sociosArea)?.id ?? null;
}

/** Tarefa cumprida por Sócio de Área (coluna "Usuário que concluiu a tarefa"). */
export function tarefaCumpridaPorSocioArea(
  row: { usuario_concluiu?: string | null },
  sociosArea: UsuarioNomeRef[]
): boolean {
  return resolveConcluidorSocioAreaId(row.usuario_concluiu, sociosArea) !== null;
}

export function filtrarTarefasCumpridasPorSocioArea<
  T extends { usuario_concluiu?: string | null },
>(rows: T[], sociosArea: UsuarioNomeRef[]): T[] {
  return rows.filter((row) => tarefaCumpridaPorSocioArea(row, sociosArea));
}

/** Remove prefixo "N. " de títulos do fluxo REVISAR (ex.: "2. REVISAR" → "REVISAR"). */
export function limparTituloRevisar(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+\.\s*revisar$/.test(normalizeNomeCompare(trimmed))) {
    return trimmed.replace(/^\d+\.\s*/i, "");
  }
  return trimmed;
}

/** Título exibido: coluna Tarefa + Tarefa Pai (apagada) quando existir e for diferente. */
export function tituloExibicaoTarefa(t: {
  tarefa?: string | null;
  tarefa_pai?: string | null;
}): { titulo: string; tarefaPai: string | null } {
  const tarefa = limparTituloRevisar(t.tarefa);
  const paiRaw = limparTituloRevisar(t.tarefa_pai);
  const pai =
    tarefa && paiRaw && normalizeNomeCompare(tarefa) === normalizeNomeCompare(paiRaw)
      ? null
      : paiRaw;
  if (tarefa) return { titulo: tarefa, tarefaPai: pai };
  if (pai) return { titulo: pai, tarefaPai: null };
  return { titulo: "Sem título", tarefaPai: null };
}

/** Texto plano para busca, prefill e activity title. */
export function tituloCompletoTarefa(t: {
  tarefa?: string | null;
  tarefa_pai?: string | null;
}): string {
  const { titulo, tarefaPai } = tituloExibicaoTarefa(t);
  if (tarefaPai) return `${titulo} · ${tarefaPai}`;
  return titulo;
}
