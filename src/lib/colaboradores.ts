import { createAdminClient } from "@/lib/supabase/server";
import { createResponsumClient } from "@/lib/responsum";
import { variantesEmailEscritorio } from "@/lib/email-escritorio";
import { urlDeFotoUtil } from "@/lib/avatar-url";
import { mapaFotosOrquestrai } from "@/lib/orquestrai-fotos";

const STALE_MS = 6 * 60 * 60 * 1000; // 6h

export { urlDeFotoUtil };

export type ColaboradorOpt = {
  id: string;
  nome: string;
  email: string;
  departamento: string | null;
  avatar_url: string | null;
  usuario_id?: string | null;
};

/** Sincroniza colaboradores ativos do Responsum para o espelho local. */
export async function sincronizarColaboradores(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  const responsum = createResponsumClient();
  if (!responsum) {
    return {
      ok: false,
      error:
        "Credenciais do Responsum não configuradas (RESPONSUM_SUPABASE_URL / RESPONSUM_SERVICE_ROLE_KEY).",
    };
  }

  const { data: rows, error } = await responsum
    .from("app_c009c0e4f1_users")
    .select("id, name, email, department, avatar_url, is_active")
    .eq("is_active", true);

  if (error || !rows) {
    return { ok: false, error: "Falha ao ler colaboradores do Responsum." };
  }

  const admin = createAdminClient();
  const { data: usuarios } = await admin.from("usuarios").select("id, email");
  const usuarioPorEmail = new Map<string, string>();
  for (const u of usuarios ?? []) {
    for (const v of variantesEmailEscritorio(u.email)) {
      usuarioPorEmail.set(v.toLowerCase(), u.id);
    }
  }

  const now = new Date().toISOString();
  const upsertRows = rows.map((r) => ({
    responsum_id: r.id,
    nome: r.name,
    email: r.email,
    departamento: r.department ?? null,
    avatar_url: urlDeFotoUtil(r.avatar_url ?? null),
    ativo: true,
    usuario_id:
      variantesEmailEscritorio(r.email)
        .map((v) => usuarioPorEmail.get(v.toLowerCase()))
        .find(Boolean) ?? null,
    sincronizado_em: now,
  }));

  const { error: upsertErr } = await admin.from("colaboradores").upsert(
    upsertRows,
    { onConflict: "responsum_id" }
  );

  if (upsertErr) {
    return { ok: false, error: "Falha ao gravar colaboradores no SAMA." };
  }

  // Desativa quem saiu do Responsum.
  const ativos = new Set(rows.map((r) => r.id));
  const { data: locais } = await admin
    .from("colaboradores")
    .select("id, responsum_id")
    .eq("ativo", true);

  const desativar = (locais ?? [])
    .filter((c) => !ativos.has(c.responsum_id))
    .map((c) => c.id);

  if (desativar.length > 0) {
    await admin
      .from("colaboradores")
      .update({ ativo: false, sincronizado_em: now })
      .in("id", desativar);
  }

  return { ok: true, count: upsertRows.length };
}

/** Garante lista local atualizada (sync se vazia ou desatualizada). */
export async function ensureColaboradoresSync() {
  const admin = createAdminClient();
  const { count } = await admin
    .from("colaboradores")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);

  const { data: latest } = await admin
    .from("colaboradores")
    .select("sincronizado_em")
    .order("sincronizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stale =
    !latest?.sincronizado_em ||
    Date.now() - new Date(latest.sincronizado_em).getTime() > STALE_MS;

  if ((count ?? 0) === 0 || stale) {
    await sincronizarColaboradores();
  }
}

type ClienteColaboradores = {
  from: (table: "colaboradores") => {
    select: (columns: string) => {
      eq: (
        column: "ativo",
        value: boolean
      ) => PromiseLike<{
        data: { email: string; avatar_url: string | null }[] | null;
      }>;
    };
  };
};

/** Fotos do espelho de colaboradores, indexadas pelo e-mail do escritório. */
export async function mapaAvatarColaboradorPorEmail(
  supabase: ClienteColaboradores
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("colaboradores")
    .select("email, avatar_url")
    .eq("ativo", true);
  const mapa = new Map<string, string>();
  for (const c of data ?? []) {
    const foto = urlDeFotoUtil(c.avatar_url);
    if (!foto) continue;
    for (const v of variantesEmailEscritorio(c.email)) {
      mapa.set(v.toLowerCase(), foto);
    }
  }
  const oficiais = await mapaFotosOrquestrai();
  for (const [email, foto] of oficiais) {
    mapa.set(email, foto);
  }
  return mapa;
}

/** Foto do mapa (ORQESTRAI por cima da cópia local). Ignora o site do escritório. */
export function avatarDaPessoa(
  email: string | null | undefined,
  avatarUsuario: string | null | undefined,
  mapa: Map<string, string>
): string | null {
  if (email) {
    for (const v of variantesEmailEscritorio(email)) {
      const foto = mapa.get(v.toLowerCase());
      if (foto) return foto;
    }
  }
  return urlDeFotoUtil(avatarUsuario);
}
