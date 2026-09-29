import { createClient } from "@/lib/supabase/server";
import { requireUsuariosAccess } from "@/lib/auth";
import { authLastSignInByUserId } from "@/lib/auth-users.server";
import { PessoasClient, type DivergenciaColaborador } from "@/components/pessoas/PessoasClient";
import type { ColaboradorSemAcesso } from "@/components/pessoas/ColaboradoresSync";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";
import type { Pessoa } from "@/types/database";
import {
  avatarDaPessoa,
  mapaAvatarColaboradorPorEmail,
} from "@/lib/colaboradores";

export const dynamic = "force-dynamic";

export default async function PessoasPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const eu = await requireUsuariosAccess();

  const { novo } = await searchParams;
  const supabase = await createClient();
  const [
    { data },
    lastSignIn,
    avatares,
    { data: modulosRows },
    { data: divergencias },
    { data: ultimoSync },
    { data: colaboradoresRows },
  ] = await Promise.all([
    supabase.from("usuarios").select("*").order("nome", { ascending: true }),
    authLastSignInByUserId(),
    mapaAvatarColaboradorPorEmail(supabase),
    supabase.from("usuario_modulos").select("usuario_id, modulo"),
    eu.is_admin
      ? supabase
          .from("colaboradores_divergencias")
          .select("id, tipo, nome, email, detalhe, detectado_em")
          .order("tipo")
          .order("nome")
      : Promise.resolve({ data: [] }),
    supabase
      .from("colaboradores")
      .select("sincronizado_em")
      .order("sincronizado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    eu.is_admin
      ? supabase
          .from("colaboradores")
          .select("id, nome, email, departamento, cargo, avatar_url, usuario_id")
          .eq("ativo", true)
          .not("orqestrai_id", "is", null)
          .order("nome")
      : Promise.resolve({ data: [] }),
  ]);

  const semAcesso: ColaboradorSemAcesso[] = (
    (colaboradoresRows ?? []) as (ColaboradorSemAcesso & { usuario_id: string | null })[]
  )
    .filter(
      (c) =>
        !c.usuario_id &&
        !((data as Pessoa[]) ?? []).some((p) => emailsEscritorioIguais(p.email, c.email))
    )
    .map(({ usuario_id: _, ...c }) => ({
      ...c,
      avatar_url: avatarDaPessoa(c.email, c.avatar_url, avatares),
    }));

  const pessoas: Pessoa[] = ((data as Pessoa[]) ?? []).map((p) => ({
    ...p,
    avatar_url: avatarDaPessoa(p.email, p.avatar_url, avatares),
    ultimo_acesso_em: p.auth_user_id
      ? (lastSignIn.get(p.auth_user_id) ?? null)
      : null,
  }));

  const modulosPorUsuario: Record<string, string[]> = {};
  for (const r of modulosRows ?? []) {
    (modulosPorUsuario[r.usuario_id] ??= []).push(r.modulo);
  }

  return (
    <PessoasClient
      pessoas={pessoas}
      autoNew={novo === "1"}
      isAdmin={eu.is_admin}
      showUltimoAcesso={eu.is_admin}
      modulosPorUsuario={modulosPorUsuario}
      divergencias={(divergencias ?? []) as DivergenciaColaborador[]}
      ultimoSync={ultimoSync?.sincronizado_em ?? null}
      semAcesso={semAcesso}
    />
  );
}
