import Link from "next/link";
import { clsx } from "clsx";
import { requireConfiguracoesAccess } from "@/lib/auth";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import { listarPastasAtendimento } from "@/lib/reuniao-pastas.server";
import { contarUsoDosTipos } from "./actions";
import { TiposReuniaoClient } from "@/components/configuracoes/TiposReuniaoClient";
import { PastasAtendimentoClient } from "@/components/configuracoes/PastasAtendimentoClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  await requireConfiguracoesAccess();
  const { aba } = await searchParams;
  const pasta = aba === "pastas";
  const pessoa = await getPessoaAtual();
  const podeEditar = pessoa?.is_admin ?? false;

  const tipos = pasta ? [] : await listarTiposReuniao();
  const uso = pasta ? {} : await contarUsoDosTipos(tipos);
  const areas = pasta ? await listarPastasAtendimento() : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">
          Listas que o sistema usa para classificar o trabalho do escritório.
        </p>
      </div>

      <div
        className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
        role="tablist"
        aria-label="Configurações"
      >
        <Link
          href="/configuracoes"
          role="tab"
          aria-selected={!pasta}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            !pasta
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Tipos de reunião
        </Link>
        <Link
          href="/configuracoes?aba=pastas"
          role="tab"
          aria-selected={pasta}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-medium transition",
            pasta
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Pastas de atendimento
        </Link>
      </div>

      {pasta ? (
        <PastasAtendimentoClient areas={areas} podeEditar={podeEditar} />
      ) : (
        <TiposReuniaoClient
          tipos={tipos.map((t) => ({ ...t, em_uso: uso[t.chave] ?? 0 }))}
          podeEditar={podeEditar}
        />
      )}
    </div>
  );
}
