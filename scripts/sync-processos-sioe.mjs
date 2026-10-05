/**
 * Copia public.processos_completo do SIOE para o SAMA.
 * Não grava pessoa_id: o uuid de pessoa do SIOE não é o do SAMA.
 *
 * Uso:
 *   SIOE_SUPABASE_URL=... SIOE_SUPABASE_ANON_KEY=... node scripts/sync-processos-sioe.mjs
 * SAMA_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY vêm do .env.local se não estiverem no ambiente.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const COLUNAS = [
  "ci",
  "grupo_cliente",
  "departamento",
  "area",
  "advogado_responsavel",
  "cliente",
  "acao",
  "acao_data_cadastro",
  "data_cadastro",
  "fase_processual",
  "nro_cnj",
  "processo_encerrado",
  "situacao_processo",
  "motivo_encerramento",
  "etiquetas",
  "data_encerramento",
  "vinculo",
].join(",");

function envArquivo(nome) {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const linha = texto.split(/\r?\n/).find((l) => l.startsWith(`${nome}=`));
  if (!linha) return "";
  return linha.slice(nome.length + 1).trim().replace(/^"|"$/g, "");
}

function obrigatorio(nome, valor) {
  if (!valor) throw new Error(`Falta ${nome}.`);
  return valor;
}

const sioeUrl = obrigatorio(
  "SIOE_SUPABASE_URL",
  process.env.SIOE_SUPABASE_URL || "https://pzfxmlidwdmsqfwrxdbd.supabase.co"
);
const sioeKey = obrigatorio("SIOE_SUPABASE_ANON_KEY", process.env.SIOE_SUPABASE_ANON_KEY);
const samaUrl = obrigatorio(
  "SAMA url",
  process.env.SAMA_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    envArquivo("NEXT_PUBLIC_SUPABASE_URL")
);
const samaKey = obrigatorio(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY || envArquivo("SUPABASE_SERVICE_ROLE_KEY")
);

const sioe = createClient(sioeUrl, sioeKey, { auth: { persistSession: false } });
const sama = createClient(samaUrl, samaKey, { auth: { persistSession: false } });

const vivos = new Set();
let gravados = 0;
const pagina = 1000;

for (let inicio = 0; ; inicio += pagina) {
  const { data, error } = await sioe
    .from("processos_completo")
    .select(COLUNAS)
    .order("ci")
    .range(inicio, inicio + pagina - 1);
  if (error) throw new Error(`Leitura SIOE: ${error.message}`);
  if (!data?.length) break;

  const linhas = data
    .filter((r) => r.ci && r.cliente)
    .map((r) => ({ ...r, ci: String(r.ci).trim() }));
  for (const r of linhas) vivos.add(r.ci);

  const { error: up } = await sama.from("processos_completo").upsert(linhas, { onConflict: "ci" });
  if (up) throw new Error(`Gravação SAMA: ${up.message}`);
  gravados += linhas.length;
  console.log(`gravados ${gravados}`);
  if (data.length < pagina) break;
}

let apagados = 0;
for (let inicio = 0; ; ) {
  const { data, error } = await sama.from("processos_completo").select("ci").range(inicio, inicio + pagina - 1);
  if (error) throw new Error(`Leitura SAMA: ${error.message}`);
  if (!data?.length) break;
  const fora = data.map((r) => r.ci).filter((ci) => ci && !vivos.has(ci));
  if (fora.length) {
    const { error: del } = await sama.from("processos_completo").delete().in("ci", fora);
    if (del) throw new Error(`Limpeza SAMA: ${del.message}`);
    apagados += fora.length;
  }
  const ficaram = data.length - fora.length;
  if (data.length < pagina) break;
  inicio += ficaram;
}

const { error: vinc } = await sama.rpc("processos_completo_vinculacao_pessoa");
if (vinc) console.warn(`Vinculação de pessoa: ${vinc.message}`);

console.log(`pronto: ${gravados} processos, ${apagados} removidos`);
