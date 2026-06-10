import Link from "next/link";
import { clsx } from "clsx";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { formatDuration } from "@/lib/format";
import { TIPO_ATIVIDADE_INTERNA } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

type Periodo = "mes" | "mes_passado" | "ano" | "tudo";

function intervalo(p: Periodo): { de: Date | null; ate: Date | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "mes") return { de: new Date(y, m, 1), ate: new Date(y, m + 1, 1) };
  if (p === "mes_passado")
    return { de: new Date(y, m - 1, 1), ate: new Date(y, m, 1) };
  if (p === "ano") return { de: new Date(y, 0, 1), ate: new Date(y + 1, 0, 1) };
  return { de: null, ate: null };
}

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "ano", label: "Este ano" },
  { key: "tudo", label: "Tudo" },
];

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const periodo = (PERIODOS.find((x) => x.key === p)?.key ?? "mes") as Periodo;
  const { de, ate } = intervalo(periodo);

  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  let query = supabase
    .from("timesheet_entradas")
    .select(
      "duracao_minutos, categoria, pessoa_id, data, pessoa:usuarios(id, nome, avatar_url)"
    );

  if (de) query = query.gte("data", de.toISOString());
  if (ate) query = query.lt("data", ate.toISOString());
  if (!isAdmin && pessoa?.id) query = query.eq("pessoa_id", pessoa.id);

  const { data: entradas } = await query;
  const rows = entradas ?? [];

  const total = rows.reduce((s, r) => s + (r.duracao_minutos ?? 0), 0);

  const porPessoa = new Map<
    string,
    { nome: string; avatar: string | null; min: number }
  >();
  const porCategoria = new Map<string, number>();
  for (const r of rows) {
    const pessoaRel = r.pessoa as
      | { nome?: string; avatar_url?: string | null }
      | null;
    const prev = porPessoa.get(r.pessoa_id) ?? {
      nome: pessoaRel?.nome ?? "Sem responsável",
      avatar: pessoaRel?.avatar_url ?? null,
      min: 0,
    };
    prev.min += r.duracao_minutos ?? 0;
    porPessoa.set(r.pessoa_id, prev);
    if (r.categoria) {
      porCategoria.set(
        r.categoria,
        (porCategoria.get(r.categoria) ?? 0) + (r.duracao_minutos ?? 0)
      );
    }
  }

  const pessoasOrdenadas = [...porPessoa.values()].sort((a, b) => b.min - a.min);
  const maxPessoa = pessoasOrdenadas[0]?.min || 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
          Timesheet
        </h1>
        <p className="text-sm text-slate-500">
          {isAdmin ? "Horas de toda a equipe" : "Suas horas"} · gerado das
          atividades internas
        </p>
      </div>

      {/* Filtro de período */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((x) => (
          <Link
            key={x.key}
            href={`/timesheet?p=${x.key}`}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium",
              periodo === x.key
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {/* Total */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Total no período</p>
        <p className="mt-1 inline-flex items-center gap-2 text-3xl font-bold text-brand-700">
          <Clock size={26} /> {formatDuration(total)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Por pessoa */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Horas por pessoa
          </h2>
          {pessoasOrdenadas.length === 0 && (
            <p className="text-sm text-slate-400">Sem registros no período.</p>
          )}
          <div className="space-y-3">
            {pessoasOrdenadas.map((p) => (
              <div key={p.nome}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-700">
                    <Avatar nome={p.nome} src={p.avatar} size={22} />
                    {p.nome}
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatDuration(p.min)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${(p.min / maxPessoa) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por tipo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Horas por tipo de atividade
          </h2>
          {porCategoria.size === 0 && (
            <p className="text-sm text-slate-400">Sem registros no período.</p>
          )}
          <div className="divide-y divide-slate-100">
            {[...porCategoria.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([cat, min]) => (
                <div key={cat} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-600">
                    {TIPO_ATIVIDADE_INTERNA[
                      cat as keyof typeof TIPO_ATIVIDADE_INTERNA
                    ] ?? cat}
                  </span>
                  <span className="font-medium text-slate-800">
                    {formatDuration(min)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
