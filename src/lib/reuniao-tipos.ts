import {
  TIPO_REUNIAO,
  TIPO_REUNIAO_DESCRICAO,
  TIPO_REUNIAO_TONE,
  TIPOS_REUNIAO_GRUPO_INTERNO,
  TIPOS_REUNIAO_NOVA,
  type TipoReuniaoKey,
} from "@/lib/constants";

/** Tipo de classificação de reunião, administrado em Configurações. */
export type TipoReuniaoItem = {
  chave: string;
  label: string;
  descricao: string;
  /** Oferecido ao classificar uma reunião nova. */
  ativo: boolean;
  /** Preenche o cliente automaticamente com o grupo interno do escritório. */
  grupo_interno: boolean;
  cor: string | null;
  ordem: number;
  /** Reuniões já classificadas com este tipo (impede excluir sem perder histórico). */
  em_uso?: number;
};

export const TONES_TIPO = [
  "blue",
  "green",
  "amber",
  "gray",
  "red",
  "purple",
] as const;

/** Cores do dashboard por tipo (mesma paleta de DASHBOARD_TIPO_COLORS). */
export const CORES_TIPO = [
  "#101f2e",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#64748b",
  "#ef4444",
  "#06b6d4",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
] as const;

const COR_POR_TONE: Record<string, string> = {
  blue: "#101f2e",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#8b5cf6",
  gray: "#64748b",
  red: "#ef4444",
};

/**
 * Lista embutida no código, usada como semente da tabela e como rede de proteção:
 * se `reuniao_tipos` ainda não existir (migration não aplicada), o sistema segue
 * funcionando com ela em vez de ficar sem nenhum tipo.
 */
export function tiposReuniaoPadrao(): TipoReuniaoItem[] {
  return (Object.keys(TIPO_REUNIAO) as TipoReuniaoKey[]).map((chave, i) => ({
    chave,
    label: TIPO_REUNIAO[chave],
    descricao: TIPO_REUNIAO_DESCRICAO[chave],
    ativo: TIPOS_REUNIAO_NOVA.includes(chave),
    grupo_interno: TIPOS_REUNIAO_GRUPO_INTERNO.includes(chave),
    cor: COR_POR_TONE[TIPO_REUNIAO_TONE[chave]] ?? null,
    ordem: (i + 1) * 10,
  }));
}

/** Gera a chave gravada em `reunioes.tipo` a partir do nome digitado. */
export function chaveDoTipo(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// ─── Helpers sem acesso ao banco (servem server e client) ────────────────────

/** Rótulo do tipo; cai no nome embutido e, por fim, na própria chave. */
export function labelTipoReuniao(
  chave: string | null | undefined,
  tipos?: readonly TipoReuniaoItem[]
): string {
  if (!chave) return "—";
  const achado = tipos?.find((t) => t.chave === chave);
  if (achado) return achado.label;
  return TIPO_REUNIAO[chave as TipoReuniaoKey] ?? chave;
}

export function descricaoTipoReuniao(
  chave: string | null | undefined,
  tipos?: readonly TipoReuniaoItem[]
): string {
  if (!chave) return "";
  const achado = tipos?.find((t) => t.chave === chave);
  if (achado) return achado.descricao;
  return TIPO_REUNIAO_DESCRICAO[chave as TipoReuniaoKey] ?? "";
}

export function tipoUsaGrupoInterno(
  chave: string | null | undefined,
  tipos?: readonly TipoReuniaoItem[]
): boolean {
  if (!chave) return false;
  const achado = tipos?.find((t) => t.chave === chave);
  if (achado) return achado.grupo_interno;
  return TIPOS_REUNIAO_GRUPO_INTERNO.includes(chave as TipoReuniaoKey);
}

/**
 * Opções do select de tipo numa reunião. Só os ativos — mais o tipo atual, para
 * que editar uma reunião antiga não troque a classificação dela sem querer.
 */
export function opcoesTipoReuniao(
  tipos: readonly TipoReuniaoItem[],
  tipoAtual?: string | null
): { value: string; label: string; description: string }[] {
  const lista = tipos.filter((t) => t.ativo);
  if (tipoAtual && !lista.some((t) => t.chave === tipoAtual)) {
    const antigo = tipos.find((t) => t.chave === tipoAtual);
    lista.push(
      antigo ?? {
        chave: tipoAtual,
        label: labelTipoReuniao(tipoAtual),
        descricao: descricaoTipoReuniao(tipoAtual),
        ativo: false,
        grupo_interno: false,
        cor: null,
        ordem: 999,
      }
    );
  }
  return lista.map((t) => ({
    value: t.chave,
    label: t.label,
    description: t.descricao,
  }));
}

/** Primeiro tipo ativo — valor inicial do formulário de reunião. */
export function tipoReuniaoPadrao(tipos: readonly TipoReuniaoItem[]): string {
  return tipos.find((t) => t.ativo)?.chave ?? "CAPTACAO";
}
