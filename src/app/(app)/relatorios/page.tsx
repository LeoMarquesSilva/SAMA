import { startOfMonth, startOfYear, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  TIPO_REUNIAO,
  STATUS_REUNIAO,
  MODALIDADE_REUNIAO,
} from "@/lib/constants";
import { RelatoriosBar } from "@/components/relatorios/RelatoriosBar";

export const dynamic = "force-dynamic";

type Periodo = "mes" | "3m" | "6m" | "ano";
function intervalo(p: Periodo): { de: Date; ate: Date } {
  const now = new Date();
  if (p === "mes") return { de: startOfMonth(now), ate: now };
  if (p === "3m") return { de: subMonths(now, 3), ate: now };
  if (p === "ano") return { de: startOfYear(now), ate: now };
  return { de: subMonths(now, 6), ate: now };
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const periodo = (["mes", "3m", "6m", "ano"].includes(sp.p ?? "")
    ? sp.p
    : "6m") as Periodo;
  const { de, ate } = intervalo(periodo);
  const tipo = sp.tipo || "";

  const supabase = await createClient();
  const eu = await getPessoaAtual();
  const isAdmin = eu?.is_admin ?? false;

  let q = supabase
    .from("reunioes")
    .select(
      "titulo, tipo, status, modalidade, data_hora_inicio, duracao_minutos, cliente:pessoas(nome), participantes:reuniao_participantes(colaborador_id, colaborador:colaboradores(nome, usuario_id))"
    )
    .gte("data_hora_inicio", de.toISOString())
    .lte("data_hora_inicio", ate.toISOString())
    .order("data_hora_inicio", { ascending: false });
  if (tipo) q = q.eq("tipo", tipo);

  const { data } = await q;
  type Row = {
    titulo: string;
    tipo: keyof typeof TIPO_REUNIAO;
    status: keyof typeof STATUS_REUNIAO;
    modalidade: keyof typeof MODALIDADE_REUNIAO;
    data_hora_inicio: string;
    duracao_minutos: number | null;
    cliente?: { nome?: string } | null;
    participantes?: {
      colaborador_id: string;
      colaborador?: { nome?: string; usuario_id?: string | null } | null;
    }[];
  };
  let rows = (data as Row[]) ?? [];
  if (!isAdmin && eu?.id) {
    rows = rows.filter((r) =>
      (r.participantes ?? []).some((p) => p.colaborador?.usuario_id === eu.id)
    );
  }

  const realizadas = rows.filter((r) => r.status === "REALIZADA").length;
  const canceladas = rows.filter((r) => r.status === "CANCELADA").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
          Relatórios
        </h1>
        <p className="text-sm text-slate-500">
          Exporte em CSV ou gere um PDF (Imprimir → Salvar como PDF)
        </p>
      </div>

      <RelatoriosBar
        periodo={periodo}
        tipo={tipo}
        de={de.toISOString()}
        ate={ate.toISOString()}
      />

      {/* Área imprimível */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 print:border-0 print:p-0">
        <div className="mb-4 hidden items-center justify-between print:flex">
          <h2 className="text-lg font-bold">SAMA — Relatório de Reuniões</h2>
          <span className="text-sm text-slate-500">
            {formatDateTime(new Date().toISOString())}
          </span>
        </div>

        <div className="mb-4 flex gap-6 text-sm">
          <span>
            Total: <strong>{rows.length}</strong>
          </span>
          <span>
            Realizadas: <strong>{realizadas}</strong>
          </span>
          <span>
            Canceladas: <strong>{canceladas}</strong>
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2 font-medium">Reunião</th>
              <th className="py-2 pr-2 font-medium">Tipo</th>
              <th className="py-2 pr-2 font-medium">Cliente</th>
              <th className="py-2 pr-2 font-medium">Início</th>
              <th className="py-2 pr-2 font-medium">Duração</th>
              <th className="py-2 pr-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Sem reuniões no período.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-2 text-slate-800">{r.titulo}</td>
                <td className="py-2 pr-2 text-slate-600">
                  {TIPO_REUNIAO[r.tipo] ?? r.tipo}
                </td>
                <td className="py-2 pr-2 text-slate-600">
                  {r.cliente?.nome ?? "—"}
                </td>
                <td className="py-2 pr-2 text-slate-600">
                  {formatDateTime(r.data_hora_inicio)}
                </td>
                <td className="py-2 pr-2 text-slate-600">
                  {formatDuration(r.duracao_minutos)}
                </td>
                <td className="py-2 pr-2 text-slate-600">
                  {STATUS_REUNIAO[r.status] ?? r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
