import { z } from "zod";

export const pessoaSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto."),
  email: z.string().trim().email("E-mail inválido."),
  cargo: z.enum(["SOCIO", "SOCIO_AREA", "COLABORADOR"], {
    message: "Selecione um cargo.",
  }),
  departamento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  is_admin: z.boolean(),
});

export type PessoaFormValues = z.infer<typeof pessoaSchema>;

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto."),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  segmento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: z.enum(["ATIVO", "INATIVO", "PROSPECTO"], {
    message: "Selecione um status.",
  }),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

// ─── REUNIÃO ──────────────────────────────────────────────────────────────
export const reuniaoSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título."),
  tipo: z.enum(["CAPTACAO", "FIDELIZACAO", "RELACIONAMENTO"], {
    message: "Selecione o tipo.",
  }),
  modalidade: z.enum(
    ["PRESENCIAL_ESCRITORIO", "PRESENCIAL_EXTERNO", "ONLINE"],
    { message: "Selecione a modalidade." }
  ),
  status: z.enum(["AGENDADA", "REALIZADA", "CANCELADA", "REAGENDADA"]),
  data_hora_inicio: z.string().min(1, "Informe data e hora de início."),
  data_hora_fim: z.string().optional(),
  duracao_minutos: z.coerce.number().int().min(0).optional(),
  cliente_id: z.string().uuid().optional().or(z.literal("")),
  link_online: z.string().optional(),
  local: z.string().optional(),
  tema: z.string().optional(),
  objetivos: z.string().optional(),
  resultado: z.string().optional(),
  proximos_passos: z.string().optional(),
  gravacao_url: z.string().optional(),
  ata_texto: z.string().optional(),
  motivo_cancelamento: z.string().optional(),
  participantes: z.array(z.string().uuid()).optional(),
});
export type ReuniaoFormValues = z.infer<typeof reuniaoSchema>;

// ─── ATIVIDADE INTERNA ──────────────────────────────────────────────────────
export const atividadeSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título."),
  tipo: z.enum(
    [
      "DESPACHO",
      "REVISAO_PECA",
      "REUNIAO_INTERNA",
      "REUNIAO_GESTAO",
      "UM_A_UM",
      "OUTROS",
    ],
    { message: "Selecione o tipo." }
  ),
  status: z.enum(["REALIZADA", "CANCELADA"]),
  data_hora_inicio: z.string().min(1, "Informe data e hora de início."),
  data_hora_fim: z.string().optional(),
  duracao_minutos: z.coerce.number().int().min(0).optional(),
  descricao: z.string().optional(),
  tema: z.string().optional(),
  com_pessoa_nome: z.string().optional(),
  com_pessoa_id: z.string().uuid().optional().or(z.literal("")),
  motivo_cancelamento: z.string().optional(),
});
export type AtividadeFormValues = z.infer<typeof atividadeSchema>;
