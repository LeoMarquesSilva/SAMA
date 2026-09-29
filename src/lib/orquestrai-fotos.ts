import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  normalizeEscritorioEmail,
  variantesEmailEscritorio,
} from "@/lib/email-escritorio";
import { urlDeFotoUtil } from "@/lib/avatar-url";

const TTL_MS = 15 * 60 * 1000;
const CONCORRENCIA = 6;
const API_URL_PADRAO =
  "https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api";

type RespostaFoto = {
  data?: { email: string | null; photoUrl: string | null; source: string };
};

const cachePorEmail = new Map<string, { exp: number; foto: string | null }>();
let cacheView: { exp: number; mapa: Map<string, string> } | null = null;

function configApi() {
  const key = process.env.ORQUESTRAI_PHOTOS_API_KEY?.trim();
  if (!key) return null;
  const url = (process.env.ORQUESTRAI_PHOTOS_API_URL?.trim() || API_URL_PADRAO).replace(
    /\/+$/,
    ""
  );
  return { url, key };
}

function clienteOrquestrai() {
  const url = process.env.ORQUESTRAI_SUPABASE_URL;
  const key = process.env.ORQUESTRAI_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Variantes do e-mail com o domínio canônico primeiro (é como o ORQESTRAI guarda). */
function variantesEmOrdem(email: string): string[] {
  const canonico = normalizeEscritorioEmail(email);
  return [canonico, ...variantesEmailEscritorio(email).filter((v) => v !== canonico)];
}

class LimiteExcedido extends Error {}

async function buscarFotoNaApi(
  api: { url: string; key: string },
  email: string
): Promise<string | null> {
  for (const variante of variantesEmOrdem(email)) {
    const res = await fetch(`${api.url}/v1/photos?email=${encodeURIComponent(variante)}`, {
      headers: { "x-api-key": api.key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) throw new LimiteExcedido();
    if (res.status === 404 || res.status === 409) continue;
    if (!res.ok) throw new Error(`official-photos-api respondeu ${res.status}`);
    const body = (await res.json()) as RespostaFoto;
    if (!body.data || body.data.source === "none") return null;
    return urlDeFotoUtil(body.data.photoUrl);
  }
  return null;
}

async function mapaViaApi(
  api: { url: string; key: string },
  emails: string[]
): Promise<Map<string, string>> {
  const agora = Date.now();
  const unicos = [...new Set(emails.map((e) => normalizeEscritorioEmail(e)).filter(Boolean))];
  const pendentes = unicos.filter((e) => (cachePorEmail.get(e)?.exp ?? 0) <= agora);

  let limite = false;
  for (let i = 0; i < pendentes.length && !limite; i += CONCORRENCIA) {
    await Promise.all(
      pendentes.slice(i, i + CONCORRENCIA).map(async (email) => {
        try {
          const foto = await buscarFotoNaApi(api, email);
          cachePorEmail.set(email, { exp: agora + TTL_MS, foto });
        } catch (e) {
          if (e instanceof LimiteExcedido) limite = true;
          else console.error("[orquestrai-fotos]", e instanceof Error ? e.message : e);
        }
      })
    );
  }

  const mapa = new Map<string, string>();
  for (const email of unicos) {
    const foto = cachePorEmail.get(email)?.foto;
    if (!foto) continue;
    for (const v of variantesEmailEscritorio(email)) mapa.set(v.toLowerCase(), foto);
  }
  return mapa;
}

async function mapaViaView(): Promise<Map<string, string>> {
  if (cacheView && cacheView.exp > Date.now()) return cacheView.mapa;

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

  cacheView = { exp: Date.now() + TTL_MS, mapa };
  return mapa;
}

/**
 * Foto oficial do ORQESTRAI, indexada pelo e-mail.
 * Com ORQUESTRAI_PHOTOS_API_KEY usa a API oficial (consulta os e-mails informados);
 * sem ela, lê a view direto com a service role (se configurada).
 */
export async function mapaFotosOrquestrai(emails: string[]): Promise<Map<string, string>> {
  const api = configApi();
  if (api) return mapaViaApi(api, emails);
  return mapaViaView();
}
