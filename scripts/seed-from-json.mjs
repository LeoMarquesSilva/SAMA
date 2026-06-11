import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
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
const data = JSON.parse(readFileSync("scripts/responsum-seed.json", "utf8"));
const sama = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: usuarios } = await sama.from("usuarios").select("id, email");
const porEmail = new Map(
  (usuarios ?? []).map((u) => [u.email.toLowerCase(), u.id])
);

const now = new Date().toISOString();
const rows = data.map((r) => ({
  responsum_id: r.id,
  nome: r.name,
  email: r.email,
  departamento: r.department ?? null,
  avatar_url: r.avatar_url ?? null,
  ativo: true,
  usuario_id: porEmail.get(r.email.toLowerCase()) ?? null,
  sincronizado_em: now,
}));

const { error } = await sama
  .from("colaboradores")
  .upsert(rows, { onConflict: "responsum_id" });

if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`OK: ${rows.length} colaboradores.`);
