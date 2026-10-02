import { requireConfiguracoesAccess } from "@/lib/auth";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { listarTiposReuniao } from "@/lib/reuniao-tipos.server";
import { contarUsoDosTipos } from "./actions";
import { TiposReuniaoClient } from "@/components/configuracoes/TiposReuniaoClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireConfiguracoesAccess();
  const pessoa = await getPessoaAtual();
  const tipos = await listarTiposReuniao();
  const uso = await contarUsoDosTipos(tipos);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configurações</h1>
        <p className="text-sm text-slate-500">
          Listas que o sistema usa para classificar o trabalho do escritório.
        </p>
      </div>

      <TiposReuniaoClient
        tipos={tipos.map((t) => ({ ...t, em_uso: uso[t.chave] ?? 0 }))}
        podeEditar={pessoa?.is_admin ?? false}
      />
    </div>
  );
}
