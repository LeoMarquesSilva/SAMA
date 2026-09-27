import "server-only";

import { createClient } from "@supabase/supabase-js";
import { variantesEmailEscritorio } from "@/lib/email-escritorio";
import { urlDeFotoUtil } from "@/lib/avatar-url";

const TTL_MS = 15 * 60 * 1000;

let cache: { exp: number; mapa: Map<string, string> } | null = null;

function clienteOrquestrai() {
  const url = process.env.ORQUESTRAI_SUPABASE_URL;
  const key = process.env.ORQUESTRAI_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Foto oficial do ORQESTRAI (uso dos sistemas), indexada pelo e-mail. */
export async function mapaFotosOrquestrai(): Promise<Map<string, string>> {
  if (cache && cache.exp > Date.now()) return cache.mapa;

  const mapa = new Map<string, string>();
  const client = clienteOrquestrai();
  if (!client) return mapa;

  const { data, error } = await client
    .from("official_system_photos")
    .select("email, photo_url, source")
    .limit(1000);

  if (error || !data) return mapa;

  for (const row of data) {
    if (row.source === "none") continue;
    const foto = urlDeFotoUtil(row.photo_url);
    if (!foto || !row.email) continue;
    for (const v of variantesEmailEscritorio(row.email)) {
      mapa.set(v.toLowerCase(), foto);
    }
  }

  cache = { exp: Date.now() + TTL_MS, mapa };
  return mapa;
}
