import Link from "next/link";
import { clsx } from "clsx";
import { requireConfiguracoesAccess } from "@/lib/auth";
import { getModulosAtuais } from "@/lib/currentPessoa";
import { temModulo } from "@/lib/modulos";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import { listarPastasAtendimento } from "@/lib/reuniao-pastas.server";
import {
  listarAgendaPositiva,
  reunioesPorCliente,
} from "@/lib/agenda-positiva.server";
import {
  isGrupoInternoAgenda,
  mesAtualKey,
  somarMeses,
} from "@/lib/agenda-positiva";
import { contarUsoDosTipos } from "./actions";
import { TiposReuniaoClient } from "@/components/configuracoes/TiposReuniaoClient";
import { PastasAtendimentoClient } from "@/components/configuracoes/PastasAtendimentoClient";
import { AgendaPositivaClient } from "@/components/configuracoes/AgendaPositivaClient";

export const dynamic = "force-dynamic";

const ABAS = [
  { key: "tipos", label: "Tipos de reunião", href: "/configuracoes" },
  { key: "pastas", label: "Pastas de atendimento", href: "/configuracoes?aba=pastas" },
  { key: "agenda", label: "Agenda Positiva", href: "/configuracoes?aba=agenda" },
] as const;

type Aba = (typeof ABAS)[number]["key"];

/** Reuniões realizadas por cliente nos últimos 6 meses, para orientar a meta e sugerir clientes. */
async function contagem6m(): Promise<Record<string, number>> {
  const mes = mesAtualKey();
  const reunioes = await reunioesPorCliente(somarMeses(mes, -5), mes);
  const total: Record<string, number> = {};
  for (const r of reunioes) {
    if (r.status === "REALIZADA") total[r.cliente] = (total[r.cliente] ?? 0) + 1;
  }
  return total;
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const pessoa = await requireConfiguracoesAccess();
  const { aba: abaParam } = await searchParams;
  const podeEditar = pessoa.is_admin;
  // A aba da Agenda Positiva segue o acesso ao dashboard dela (hoje, só admins).
  const verAgenda = temModulo(
    { isAdmin: pessoa.is_admin, modulos: await getModulosAtuais() },
    "agenda-positiva"
  );
  const abas = ABAS.filter((a) => a.key !== "agenda" || verAgenda);
  const aba: Aba = abas.some((a) => a.key === abaParam) ? (abaParam as Aba) : "tipos";

  const tipos = aba === "tipos" ? await listarTiposReuniao() : [];
  const uso = aba === "tipos" ? await contarUsoDosTipos(tipos) : {};
  const areas = aba === "pastas" ? await listarPastasAtendimento() : [];
  const [agenda, reunioes6m] =
    aba === "agenda"
      ? await Promise.all([listarAgendaPositiva(), contagem6m()])
      : [{ clientes: [], semTabela: false }, {}];

  const naAgenda = new Set(agenda.clientes.map((c) => c.grupo_cliente));
  const sugestoes = Object.entries(reunioes6m)
    .filter(([grupo]) => !naAgenda.has(grupo) && !isGrupoInternoAgenda(grupo))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([grupo_cliente, total]) => ({ grupo_cliente, total }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">
          Listas que o sistema usa para classificar o trabalho do escritório.
        </p>
      </div>

      <div
        className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-100 p-1"
        role="tablist"
        aria-label="Configurações"
      >
        {abas.map((a) => (
          <Link
            key={a.key}
            href={a.href}
            role="tab"
            aria-selected={aba === a.key}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              aba === a.key
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {aba === "pastas" ? (
        <PastasAtendimentoClient areas={areas} podeEditar={podeEditar} />
      ) : aba === "agenda" ? (
        <AgendaPositivaClient
          clientes={agenda.clientes}
          semTabela={agenda.semTabela}
          podeEditar={podeEditar}
          reunioes6m={reunioes6m}
          sugestoes={sugestoes}
        />
      ) : (
        <TiposReuniaoClient
          tipos={tipos.map((t) => ({ ...t, em_uso: uso[t.chave] ?? 0 }))}
          podeEditar={podeEditar}
        />
      )}
    </div>
  );
}
