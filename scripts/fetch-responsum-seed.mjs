/**
 * Busca colaboradores ativos do Responsum via MCP SQL export e grava JSON local.
 * Rode manualmente após exportar o JSON do Responsum, ou configure RESPONSUM_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

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
const url = env.RESPONSUM_SUPABASE_URL || "https://jhgbrbarfpvgdaaznldj.supabase.co";
const key = env.RESPONSUM_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Configure RESPONSUM_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

const responsum = createClient(url, key);
const { data, error } = await responsum
  .from("app_c009c0e4f1_users")
  .select("id, name, email, department, avatar_url")
  .eq("is_active", true)
  .order("department")
  .order("name");

if (error || !data) {
  console.error(error?.message ?? "sem dados");
  process.exit(1);
}

writeFileSync("scripts/responsum-seed.json", JSON.stringify(data, null, 2));
console.log(`Gravado scripts/responsum-seed.json (${data.length} registros)`);
