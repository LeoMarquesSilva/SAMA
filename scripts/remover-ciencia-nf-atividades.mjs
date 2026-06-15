/**
 * Remove atividades Ciência NF (legado VIOS) e entradas de timesheet em cascata.
 * Uso: node scripts/remover-ciencia-nf-atividades.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { count, error: countErr } = await supabase
  .from("atividades_internas")
  .select("id", { count: "exact", head: true })
  .eq("tipo", "CIENCIA_NF");

if (countErr) {
  console.error(countErr.message);
  process.exit(1);
}

console.log(`Atividades Ciência NF a remover: ${count ?? 0}`);

const { error } = await supabase
  .from("atividades_internas")
  .delete()
  .eq("tipo", "CIENCIA_NF");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("Concluído.");
