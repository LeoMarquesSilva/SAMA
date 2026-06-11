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
  RELACIONAMENTO_INSTITUCIONAL: "Relacionamento Institucional",
  GESTAO_ESTRATEGICA: "Gestão Estratégica",
  GESTAO_EQUIPE: "Gestão de Equipe",
  GESTAO_OPERACIONAL: "Gestão Operacional",
} as const;

export type TipoReuniaoKey = keyof typeof TIPO_REUNIAO;

export const TIPO_REUNIAO_DESCRICAO: Record<TipoReuniaoKey, string> = {
  CAPTACAO:
    "Reuniões com potenciais clientes, parceiros ou contatos estratégicos com o objetivo de gerar novas oportunidades de negócio, apresentar o escritório ou desenvolver relacionamentos comerciais que possam resultar em contratação de serviços.",
  FIDELIZACAO:
    "Reuniões com clientes e Consultores ativos, voltadas ao fortalecimento do relacionamento, acompanhamento da satisfação, identificação de novas demandas e ampliação da parceria entre cliente e escritório.",
  RELACIONAMENTO_INSTITUCIONAL:
    "Reuniões destinadas à construção e manutenção de relacionamentos estratégicos com autoridades, entidades de classe, associações, parceiros institucionais, formadores de opinião e demais stakeholders relevantes para o posicionamento do escritório.",
  GESTAO_ESTRATEGICA:
    "Reuniões entre sócios, gestores ou lideranças destinadas à discussão de temas estratégicos, resultados, indicadores, planejamento, governança, orçamento, projetos e direcionamento do escritório.",
  GESTAO_EQUIPE:
    "Reuniões voltadas à liderança e desenvolvimento de pessoas, incluindo one a ones, feedbacks, acompanhamento de desempenho, alinhamentos de equipe, PDIs e temas relacionados à gestão de colaboradores.",
  GESTAO_OPERACIONAL:
    "Reuniões destinadas à discussão de casos, processos, operações, demandas específicas de clientes, alinhamentos técnicos ou operacionais, definição de estratégias processuais e acompanhamento da execução das atividades.",
};

export const TIPO_REUNIAO_TONE: Record<
  TipoReuniaoKey,
  "blue" | "green" | "amber" | "gray" | "red" | "purple"
> = {
  CAPTACAO: "blue",
  FIDELIZACAO: "green",
  RELACIONAMENTO_INSTITUCIONAL: "amber",
  GESTAO_ESTRATEGICA: "purple",
  GESTAO_EQUIPE: "gray",
  GESTAO_OPERACIONAL: "red",
};

/** Opções para SelectMenu; inclui descrição quando usado no formulário. */
export function tipoReuniaoOptions(withDescription = true) {
  return (Object.keys(TIPO_REUNIAO) as TipoReuniaoKey[]).map((k) => ({
    value: k,
    label: TIPO_REUNIAO[k],
    ...(withDescription ? { description: TIPO_REUNIAO_DESCRICAO[k] } : {}),
  }));
}

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
  PARECER: "Parecer",
  DESPACHO: "Despacho",
  REVISAO_PRAZO: "Revisão de prazo (Revisar)",
  ELABORACAO_PRAZO: "Elaboração de Prazo (Enviar)",
  AUDIENCIA: "Audiência",
  SUSTENTACAO_ORAL: "Sustentação Oral",
  PALESTRAS_EVENTOS: "Palestras / Eventos",
} as const;

export type TipoAtividadeKey = keyof typeof TIPO_ATIVIDADE_INTERNA;

export function atividadeTipoOptions() {
  return (Object.keys(TIPO_ATIVIDADE_INTERNA) as TipoAtividadeKey[]).map((k) => ({
    value: k,
    label: TIPO_ATIVIDADE_INTERNA[k],
  }));
}
