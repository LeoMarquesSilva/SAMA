import { z } from "zod";
import { TIPO_ATIVIDADE_INTERNA, TIPO_REUNIAO } from "@/lib/constants";
import { isUrl } from "@/lib/validate";

const TIPOS_REUNIAO = Object.keys(TIPO_REUNIAO) as [
  keyof typeof TIPO_REUNIAO,
  ...Array<keyof typeof TIPO_REUNIAO>,
];

const TIPOS_ATIVIDADE = Object.keys(TIPO_ATIVIDADE_INTERNA) as [
  keyof typeof TIPO_ATIVIDADE_INTERNA,
  ...Array<keyof typeof TIPO_ATIVIDADE_INTERNA>,
];

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
export const reuniaoSchema = z
  .object({
    titulo: z.string().trim().min(2, "Informe um título."),
    tipo: z.enum(TIPOS_REUNIAO, {
      message: "Selecione o tipo.",
    }),
    modalidade: z.enum(
      ["PRESENCIAL_ESCRITORIO", "PRESENCIAL_EXTERNO", "ONLINE"],
      { message: "Selecione a modalidade." }
    ),
    status: z.enum(["AGENDADA", "REALIZADA", "CANCELADA", "REAGENDADA"]),
    data_hora_inicio: z.string().min(1, "Informe data e hora de início."),
    data_hora_fim: z.string().min(1, "Informe data e hora de fim."),
    duracao_minutos: z.coerce
      .number()
      .int()
      .min(1, "Informe a duração em minutos."),
    cliente_id: z
      .string()
      .trim()
      .min(1, "Selecione ou crie um cliente."),
    link_online: z.string().optional().or(z.literal("")),
    local: z.string().optional(),
    tema: z.string().optional(),
    objetivos: z.string().optional(),
    resultado: z.string().optional(),
    proximos_passos: z.string().optional(),
    ata_texto: z.string().optional(),
    motivo_cancelamento: z.string().optional(),
    participantes: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos um participante."),
  })
  .superRefine((data, ctx) => {
    if (
      data.data_hora_fim &&
      data.data_hora_inicio &&
      new Date(data.data_hora_fim) <= new Date(data.data_hora_inicio)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "O fim deve ser depois do início.",
        path: ["data_hora_fim"],
      });
    }

    const link = data.link_online?.trim();
    if (link && !isUrl(link)) {
      ctx.addIssue({
        code: "custom",
        message: "Link inválido — use http(s)://...",
        path: ["link_online"],
      });
    }

    if (data.modalidade === "PRESENCIAL_EXTERNO" && !data.local?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o local.",
        path: ["local"],
      });
    }

    if (data.status === "REALIZADA") {
      if (!data.resultado?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Informe o resultado.",
          path: ["resultado"],
        });
      }
      if (!data.proximos_passos?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Informe os próximos passos.",
          path: ["proximos_passos"],
        });
      }
    }

    if (data.status === "CANCELADA" && !data.motivo_cancelamento?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Informe o motivo do cancelamento.",
        path: ["motivo_cancelamento"],
      });
    }
  });
export type ReuniaoFormValues = z.infer<typeof reuniaoSchema>;

// ─── ATIVIDADE INTERNA ──────────────────────────────────────────────────────
export const atividadeSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título."),
  tipo: z.enum(TIPOS_ATIVIDADE, { message: "Selecione o tipo." }),
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
