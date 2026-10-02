// Enums de domínio — espelham os CHECK constraints da migration SQL.

export const APP_NAME = "SAMA";
export const APP_FULL_NAME = "Sistema de Análise de Metas e Atividades";
export const APP_TITLE = `${APP_NAME} — ${APP_FULL_NAME}`;

/** Exibe o botão "Reclassificação Atividade" no calendário (eventos Outlook pendentes). */
export const EXIBIR_RECLASSIFICACAO_ATIVIDADE = false;

export const CARGO_PESSOA = {
  SOCIO: "Sócio",
  SOCIO_AREA: "Sócio de Área",
  COLABORADOR: "Colaborador",
} as const;
export type CargoPessoa = keyof typeof CARGO_PESSOA;

/** Áreas/departamentos do escritório (cadastro de usuários). */
export const DEPARTAMENTO_USUARIO = [
  "Cível",
  "Distressed Deals - Special Situations",
  "Geral",
  "Operações Legais",
  "Reestruturação e Insolvência",
  "Societário e Contratos",
  "Sócio",
  "T.I",
  "Trabalhista",
  "Tributário",
] as const;

export type DepartamentoUsuario = (typeof DEPARTAMENTO_USUARIO)[number];

function chaveDepartamento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/** Nome oficial da área, ignorando acento/maiúsculas (ex.: "Operacoes Legais" → "Operações Legais"). */
export function departamentoCanonico(d: string | null | undefined): string | null {
  if (!d?.trim()) return null;
  const k = chaveDepartamento(d);
  return DEPARTAMENTO_USUARIO.find((o) => chaveDepartamento(o) === k) ?? d.trim();
}

export function departamentoUsuarioOptions(): { value: string; label: string }[] {
  return DEPARTAMENTO_USUARIO.map((label) => ({ value: label, label }));
}

/** Departamento que identifica sócio fundador (junto com cargo SOCIO). */
export const DEPARTAMENTO_SOCIO_FUNDADOR = "Sócio" as const satisfies DepartamentoUsuario;

/** Sócio fundador: cargo Sócio + departamento Sócio (identidade; admin é is_admin). */
export function isSocioFundador(
  cargo: CargoPessoa,
  departamento: string | null | undefined
): boolean {
  return cargo === "SOCIO" && departamento === DEPARTAMENTO_SOCIO_FUNDADOR;
}

type PessoaAgenda = {
  is_admin: boolean;
  cargo: CargoPessoa;
  departamento: string | null;
  /** Visão 360º: vê os dados dos demais usuários sem ser admin. */
  visao_global?: boolean | null;
};

/** Agenda de todos: admin, qualquer sócio ou quem tem visão 360º (ECOA F1.2). */
export function canViewAgendaTodos(
  pessoa: PessoaAgenda | null | undefined
): boolean {
  if (!pessoa) return false;
  return (
    pessoa.is_admin || pessoa.cargo === "SOCIO" || pessoa.visao_global === true
  );
}

type PessoaAgendaComId = PessoaAgenda & { id?: string | null };

/** Própria agenda, mesma área ou visão global (sócio/admin). */
export function podeVerAgendaDe(
  viewer: PessoaAgendaComId | null | undefined,
  target: { id?: string | null; departamento?: string | null }
): boolean {
  if (!viewer) return false;
  if (canViewAgendaTodos(viewer)) return true;
  if (viewer.id && target.id && viewer.id === target.id) return true;
  return Boolean(
    viewer.departamento &&
      target.departamento &&
      viewer.departamento === target.departamento
  );
}

/** Rótulo de cargo na UI — distingue Sócio fundador dos demais cargos Sócio. */
export function cargoPessoaLabel(
  cargo: CargoPessoa,
  departamento?: string | null
): string {
  if (isSocioFundador(cargo, departamento)) return "Sócio fundador";
  return CARGO_PESSOA[cargo];
}

/** Classificação da demanda tratada na reunião (ECOA). */
export const DEMANDA_REUNIAO = {
  INSOLVENCIA: "Insolvência",
  CIVEL: "Cível",
  INSOLVENCIA_CIVEL: "Insolvência e Cível",
} as const;

export type DemandaReuniaoKey = keyof typeof DEMANDA_REUNIAO;

export function demandaReuniaoOptions() {
  return (Object.keys(DEMANDA_REUNIAO) as DemandaReuniaoKey[]).map((k) => ({
    value: k,
    label: DEMANDA_REUNIAO[k],
  }));
}

export const STATUS_CLIENTE = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  PROSPECTO: "Prospecto",
} as const;
export type StatusCliente = keyof typeof STATUS_CLIENTE;

// ─── Enums das próximas fases (referência) ───────────────────────────────────

export const TIPO_REUNIAO = {
  CAPTACAO: "Captação / Cross-selling",
  FIDELIZACAO: "Fidelização",
  RELACIONAMENTO_INSTITUCIONAL: "Relacionamento institucional",
  GESTAO_ESTRATEGICA: "Gestão Estratégica",
  GESTAO_EQUIPE: "Gestão de Equipe",
  GESTAO_OPERACIONAL: "Operacional",
  EVENTOS_PALESTRAS: "Eventos e Palestras",
} as const;

/** Grupo VIOS vinculado automaticamente a reuniões internas do escritório. */
export const GRUPO_CLIENTE_GESTAO_EQUIPE = "Grupo Bismarchi Pires";

export type TipoReuniaoKey = keyof typeof TIPO_REUNIAO;

/** Tipos que preenchem o cliente automaticamente com o grupo interno. */
export const TIPOS_REUNIAO_GRUPO_INTERNO: TipoReuniaoKey[] = [
  "GESTAO_EQUIPE",
  "GESTAO_OPERACIONAL",
];

export function reuniaoTipoUsaGrupoInterno(tipo: TipoReuniaoKey): boolean {
  return TIPOS_REUNIAO_GRUPO_INTERNO.includes(tipo);
}

export const TIPO_REUNIAO_DESCRICAO: Record<TipoReuniaoKey, string> = {
  CAPTACAO:
    "Reuniões voltadas à geração de receita nova: prospecção de potenciais clientes, parceiros e contatos estratégicos, e também a oferta de outras áreas do escritório a clientes que já são da casa (cross-selling). Inclui apresentação institucional, levantamento de necessidades e desdobramentos que possam resultar em nova contratação de serviços.",
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
  EVENTOS_PALESTRAS:
    "Participação em congressos, seminários, palestras, workshops, treinamentos e demais eventos voltados à atualização técnica, desenvolvimento profissional, compartilhamento de conhecimento e ampliação de networking.",
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
  EVENTOS_PALESTRAS: "purple",
};

/**
 * Opções para SelectMenu com TODOS os tipos, inclusive os que saíram de uso.
 * É o que vale para filtro de dashboard/relatório: metade da base usa os antigos
 * e sem eles não haveria como filtrar aquelas reuniões.
 */
export function tipoReuniaoOptions(withDescription = true) {
  return (Object.keys(TIPO_REUNIAO) as TipoReuniaoKey[]).map((k) => ({
    value: k,
    label: TIPO_REUNIAO[k],
    ...(withDescription ? { description: TIPO_REUNIAO_DESCRICAO[k] } : {}),
  }));
}

/** Tipos que uma reunião nova pode receber. Os demais ficam só no histórico. */
export const TIPOS_REUNIAO_NOVA: TipoReuniaoKey[] = [
  "GESTAO_OPERACIONAL",
  "CAPTACAO",
  "RELACIONAMENTO_INSTITUCIONAL",
];

/**
 * Opções do tipo no formulário de reunião. Só os tipos em uso — mas, ao editar
 * uma reunião antiga, o tipo dela entra na lista para não ser trocado sem querer
 * ao salvar.
 */
export function tipoReuniaoOptionsNova(tipoAtual?: TipoReuniaoKey | null) {
  const keys = [...TIPOS_REUNIAO_NOVA];
  if (tipoAtual && TIPO_REUNIAO[tipoAtual] && !keys.includes(tipoAtual)) {
    keys.push(tipoAtual);
  }
  return keys.map((k) => ({
    value: k,
    label: TIPO_REUNIAO[k],
    description: TIPO_REUNIAO_DESCRICAO[k],
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
  REVISAO_PRAZO: "Revisão",
  ELABORACAO_PRAZO: "Elaboração de Prazo (Enviar)",
  AUDIENCIA: "Audiência",
  SUSTENTACAO_ORAL: "Sustentação Oral",
  PALESTRAS_EVENTOS: "Palestras / Eventos",
  CIENCIA_NF: "Ciência NF",
  LEVANTAMENTO_DUE_PROPOSTA_CONTRATO: "Levantamento de Due / Proposta / Contrato",
} as const;

export type TipoAtividadeKey = keyof typeof TIPO_ATIVIDADE_INTERNA;

export function atividadeTipoOptions() {
  return (Object.keys(TIPO_ATIVIDADE_INTERNA) as TipoAtividadeKey[]).map((k) => ({
    value: k,
    label: TIPO_ATIVIDADE_INTERNA[k],
  }));
}

/** Opções da página Atividades (sem Ciência NF). */
export function atividadeTipoOptionsAtividades() {
  return atividadeTipoOptions().filter((o) => o.value !== "CIENCIA_NF");
}
