import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { formatDate } from "@/lib/format";
import { TIPO_ATIVIDADE_INTERNA } from "@/lib/constants";

function csv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/\r?\n/g, " ").trim().replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const pessoa = searchParams.get("pessoa");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;
  const scope = isAdmin ? pessoa : eu?.id ?? "__none__";

  let q = supabase
    .from("timesheet_entradas")
    .select("data, duracao_minutos, categoria, descricao, pessoa:usuarios(nome)")
    .order("data", { ascending: false });
  if (de) q = q.gte("data", de);
  if (ate) q = q.lte("data", ate);
  if (scope) q = q.eq("pessoa_id", scope);

  const { data } = await q;
  type Row = {
    data: string;
    duracao_minutos: number;
    categoria: string | null;
    descricao: string | null;
    pessoa?: { nome?: string } | null;
  };
  const rows = (data as Row[]) ?? [];

  const header = [
    "Data",
    "Pessoa",
    "Categoria",
    "Duração (min)",
    "Horas",
    "Descrição",
  ];
  const linhas = rows.map((r) =>
    [
      formatDate(r.data),
      r.pessoa?.nome ?? "",
      TIPO_ATIVIDADE_INTERNA[
        r.categoria as keyof typeof TIPO_ATIVIDADE_INTERNA
      ] ??
        r.categoria ??
        "",
      r.duracao_minutos ?? 0,
      ((r.duracao_minutos ?? 0) / 60).toFixed(2).replace(".", ","),
      r.descricao ?? "",
    ]
      .map(csv)
      .join(";")
  );

  const conteudo = "﻿" + [header.map(csv).join(";"), ...linhas].join("\r\n");
  const nome = `timesheet_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
