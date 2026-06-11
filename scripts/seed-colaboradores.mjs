/**
 * Seed inicial de colaboradores via MCP/SQL manual ou Responsum API.
 * Uso: node scripts/seed-colaboradores.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv();
const sama = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const responsumUrl =
  env.RESPONSUM_SUPABASE_URL || "https://jhgbrbarfpvgdaaznldj.supabase.co";
const responsumKey = env.RESPONSUM_SERVICE_ROLE_KEY;
if (!responsumKey) {
  console.error(
    "RESPONSUM_SERVICE_ROLE_KEY não configurada — adicione ao .env.local"
  );
  process.exit(1);
}

const responsum = createClient(responsumUrl, responsumKey);

const { data: rows, error } = await responsum
  .from("app_c009c0e4f1_users")
  .select("id, name, email, department, avatar_url, is_active")
  .eq("is_active", true);

if (error || !rows?.length) {
  console.error("Falha ao ler Responsum:", error?.message);
  process.exit(1);
}

const { data: usuarios } = await sama.from("usuarios").select("id, email");
const porEmail = new Map(
  (usuarios ?? []).map((u) => [u.email.toLowerCase(), u.id])
);

const now = new Date().toISOString();
const upsert = rows.map((r) => ({
  responsum_id: r.id,
  nome: r.name,
  email: r.email,
  departamento: r.department ?? null,
  avatar_url: r.avatar_url ?? null,
  ativo: true,
  usuario_id: porEmail.get(r.email.toLowerCase()) ?? null,
  sincronizado_em: now,
}));

const { error: upErr } = await sama
  .from("colaboradores")
  .upsert(upsert, { onConflict: "responsum_id" });

if (upErr) {
  console.error("Falha no upsert:", upErr.message);
  process.exit(1);
}

console.log(`OK: ${upsert.length} colaboradores sincronizados.`);
