// Enums de domínio — espelham os CHECK constraints da migration SQL.

export const CARGO_PESSOA = {
  SOCIO: "Sócio",
  SOCIO_AREA: "Sócio de Área",
  COLABORADOR: "Colaborador",
} as const;
export type CargoPessoa = keyof typeof CARGO_PESSOA;

/** Sócio fundador — acesso total ao sistema (espelha is_admin no banco). */
export function isAdminCargo(cargo: CargoPessoa): boolean {
  return cargo === "SOCIO";
}

export const STATUS_CLIENTE = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  PROSPECTO: "Prospecto",
} as const;
export type StatusCliente = keyof typeof STATUS_CLIENTE;

// ─── Enums das próximas fases (referência) ───────────────────────────────────

export const TIPO_REUNIAO = {
  CAPTACAO: "Captação",
  FIDELIZACAO: "Fidelização",
  RELACIONAMENTO: "Relacionamento",
} as const;

export const MODALIDADE_REUNIAO = {
  PRESENCIAL_ESCRITORIO: "Presencial – Escritório",
  PRESENCIAL_EXTERNO: "Presencial – Externo",
  ONLINE: "Online",
} as const;

export const STATUS_REUNIAO = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  REAGENDADA: "Reagendada",
} as const;

export const TIPO_ATIVIDADE_INTERNA = {
  DESPACHO: "Despacho",
  REVISAO_PECA: "Revisão de peça",
  REUNIAO_INTERNA: "Reunião interna",
  REUNIAO_GESTAO: "Reunião de gestão",
  UM_A_UM: "1:1",
  OUTROS: "Outros",
} as const;
