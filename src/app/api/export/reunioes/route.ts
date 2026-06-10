import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { formatDateTime } from "@/lib/format";
import {
  TIPO_REUNIAO,
  MODALIDADE_REUNIAO,
  STATUS_REUNIAO,
} from "@/lib/constants";

function csv(v: unknown): string {
  const s = v == null ? "" : String(v);
  const limpo = s.replace(/\r?\n/g, " ").trim();
  return `"${limpo.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const tipo = searchParams.get("tipo");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;

  let q = supabase
    .from("reunioes")
    .select(
      "titulo, tipo, status, modalidade, data_hora_inicio, data_hora_fim, duracao_minutos, local, link_online, tema, resultado, criado_em, cliente:pessoas(nome), participantes:reuniao_participantes(pessoa_id, pessoa:usuarios(nome))"
    )
    .order("data_hora_inicio", { ascending: false });
  if (de) q = q.gte("data_hora_inicio", de);
  if (ate) q = q.lte("data_hora_inicio", ate);
  if (tipo) q = q.eq("tipo", tipo);

  const { data } = await q;
  type Row = {
    titulo: string;
    tipo: keyof typeof TIPO_REUNIAO;
    status: keyof typeof STATUS_REUNIAO;
    modalidade: keyof typeof MODALIDADE_REUNIAO;
    data_hora_inicio: string;
    data_hora_fim: string | null;
    duracao_minutos: number | null;
    local: string | null;
    link_online: string | null;
    tema: string | null;
    resultado: string | null;
    criado_em: string;
    cliente?: { nome?: string } | null;
    participantes?: { pessoa_id: string; pessoa?: { nome?: string } | null }[];
  };
  let rows = (data as Row[]) ?? [];
  if (!isAdmin && eu?.id) {
    rows = rows.filter((r) =>
      (r.participantes ?? []).some((p) => p.pessoa_id === eu.id)
    );
  }

  const header = [
    "Título",
    "Tipo",
    "Status",
    "Modalidade",
    "Início",
    "Fim",
    "Duração (min)",
    "Cliente",
    "Participantes",
    "Tema",
    "Resultado",
    "Local",
    "Link",
    "Criada em",
  ];

  const linhas = rows.map((r) =>
    [
      r.titulo,
      TIPO_REUNIAO[r.tipo] ?? r.tipo,
      STATUS_REUNIAO[r.status] ?? r.status,
      MODALIDADE_REUNIAO[r.modalidade] ?? r.modalidade,
      formatDateTime(r.data_hora_inicio),
      formatDateTime(r.data_hora_fim),
      r.duracao_minutos ?? "",
      r.cliente?.nome ?? "",
      (r.participantes ?? [])
        .map((p) => p.pessoa?.nome)
        .filter(Boolean)
        .join(", "),
      r.tema ?? "",
      r.resultado ?? "",
      r.local ?? "",
      r.link_online ?? "",
      formatDateTime(r.criado_em),
    ]
      .map(csv)
      .join(";")
  );

  // BOM UTF-8 + delimitador ';' para abrir certo no Excel pt-BR.
  const conteudo = "﻿" + [header.map(csv).join(";"), ...linhas].join("\r\n");
  const nome = `reunioes_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
