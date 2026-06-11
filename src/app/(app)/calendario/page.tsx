import { createClient } from "@/lib/supabase/server";
import { getPessoaAtual } from "@/lib/currentPessoa";
import { ensureColaboradoresSync } from "@/lib/colaboradores";
import { OutlookClient } from "@/components/outlook/OutlookClient";
import { outlookConfigurado } from "@/lib/graph";
import type { OutlookEventoComPessoa } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  await ensureColaboradoresSync();

  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  const isAdmin = pessoa?.is_admin ?? false;

  let query = supabase
    .from("outlook_eventos")
    .select("*, pessoa:usuarios(id, nome, email, avatar_url)")
    .order("inicio", { ascending: true, nullsFirst: false })
    .limit(200);

  if (!isAdmin && pessoa?.id) query = query.eq("pessoa_id", pessoa.id);

  const [{ data: eventos }, { data: pessoas }, { data: colaboradores }] =
    await Promise.all([
      query,
      supabase.from("usuarios").select("id, nome, email, avatar_url").order("nome"),
      supabase
        .from("colaboradores")
        .select("id, nome, email, departamento, avatar_url, usuario_id")
        .eq("ativo", true)
        .order("nome"),
    ]);

  return (
    <div className="space-y-4">
      {!outlookConfigurado() && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Credenciais da Microsoft não detectadas no ambiente. A sincronização
          automática não funcionará até configurar o <code>.env</code>.
        </p>
      )}
      <OutlookClient
        eventos={(eventos as OutlookEventoComPessoa[]) ?? []}
        pessoas={pessoas ?? []}
        colaboradores={colaboradores ?? []}
        isAdmin={isAdmin}
        pessoaAtualId={pessoa?.id ?? null}
      />
    </div>
  );
}
