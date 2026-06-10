import type { CargoPessoa } from "@/lib/constants";

export type Pessoa = {
  id: string;
  auth_user_id: string | null;
  nome: string;
  email: string;
  cargo: CargoPessoa;
  departamento: string | null;
  avatar_url: string | null;
  outlook_id: string | null;
  is_admin: boolean;
  senha_provisoria: boolean;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

// Cliente VIOS = public.pessoas (espelho SIOE; equipe interna = public.usuarios).
export type Cliente = {
  id: string;
  ci: string | null;
  etiquetas: string | null;
  cpf_cnpj: string | null;
  nome: string;
  nome_fantasia_apelido: string | null;
  tipo: string | null;
  data_cadastro: string | null;
  cidade: string | null;
  uf: string | null;
  logradouro: string | null;
  nro: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  abreviacao: string | null;
  responsaveis: string | null;
  telefone: string | null;
  email: string | null;
  grupo_cliente: string | null;
  categoria: string | null;
  contato_1: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  site: string | null;
  created_at: string;
  updated_at: string;
};

/** Resumo agregado por grupo (view escritorio_grupos_resumo). */
export type GrupoClienteResumo = {
  grupo_cliente: string;
  total_empresas: number;
  total_geral: number;
  horas_total: number;
};

/** Empresa vinculada a um grupo (view escritorio_empresas_por_grupo). */
export type EmpresaDoGrupo = {
  ci: string;
  nome: string;
  cpf_cnpj: string | null;
  categoria: string | null;
  qtd_processos: number;
};

export type TipoReuniao = "CAPTACAO" | "FIDELIZACAO" | "RELACIONAMENTO";
export type ModalidadeReuniao =
  | "PRESENCIAL_ESCRITORIO"
  | "PRESENCIAL_EXTERNO"
  | "ONLINE";
export type StatusReuniao =
  | "AGENDADA"
  | "REALIZADA"
  | "CANCELADA"
  | "REAGENDADA";
export type TipoAtividade =
  | "DESPACHO"
  | "REVISAO_PECA"
  | "REUNIAO_INTERNA"
  | "REUNIAO_GESTAO"
  | "UM_A_UM"
  | "OUTROS";

export type Reuniao = {
  id: string;
  outlook_event_id: string | null;
  titulo: string;
  tipo: TipoReuniao;
  status: StatusReuniao;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  duracao_minutos: number | null;
  modalidade: ModalidadeReuniao;
  link_online: string | null;
  local: string | null;
  cliente_id: string | null;
  criado_por_id: string | null;
  tema: string | null;
  objetivos: string | null;
  resultado: string | null;
  proximos_passos: string | null;
  gravacao_url: string | null;
  ata_texto: string | null;
  ata_arquivo_url: string | null;
  motivo_cancelamento: string | null;
  cancelado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

// Reunião com dados agregados para listagem.
export type ReuniaoComRelacoes = Reuniao & {
  cliente?: { ci: string; nome: string } | null;
  participantes?: {
    pessoa_id: string;
    papel: string;
    pessoa?: {
      id: string;
      nome: string;
      avatar_url: string | null;
      email?: string | null;
    } | null;
  }[];
};

export type AtividadeInterna = {
  id: string;
  outlook_event_id: string | null;
  tipo: TipoAtividade;
  titulo: string;
  descricao: string | null;
  tema: string | null;
  data_hora_inicio: string;
  data_hora_fim: string | null;
  duracao_minutos: number | null;
  pessoa_id: string;
  com_pessoa_nome: string | null;
  com_pessoa_id: string | null;
  status: "REALIZADA" | "CANCELADA";
  motivo_cancelamento: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type AtividadeComPessoa = AtividadeInterna & {
  pessoa?: { id: string; nome: string; avatar_url: string | null } | null;
  com_pessoa?: { id: string; nome: string; avatar_url: string | null } | null;
};

export type TimesheetEntrada = {
  id: string;
  pessoa_id: string;
  atividade_interna_id: string | null;
  data: string;
  duracao_minutos: number;
  descricao: string | null;
  categoria: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type OutlookEventoStatus =
  | "PENDENTE"
  | "CATEGORIZADO_REUNIAO"
  | "CATEGORIZADO_ATIVIDADE"
  | "IGNORADO";

export type OutlookEvento = {
  id: string;
  pessoa_id: string;
  outlook_event_id: string;
  titulo: string | null;
  inicio: string | null;
  fim: string | null;
  duracao_minutos: number | null;
  local: string | null;
  online: boolean;
  link_online: string | null;
  organizador_nome: string | null;
  organizador_email: string | null;
  participantes: { nome: string; email: string }[];
  corpo_preview: string | null;
  status: OutlookEventoStatus;
  reuniao_id: string | null;
  atividade_id: string | null;
  categorizado_em: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type OutlookEventoComPessoa = OutlookEvento & {
  pessoa?: {
    id: string;
    nome: string;
    email: string;
    avatar_url?: string | null;
  } | null;
};

// Payloads de criação/edição (sem campos gerados pelo banco).
export type PessoaInput = Pick<
  Pessoa,
  "nome" | "email" | "cargo" | "ativo"
> & { avatar_url?: string | null };

