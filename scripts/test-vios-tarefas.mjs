/**
 * Teste rápido da API VIOS (tarefas). Uso: node scripts/test-vios-tarefas.mjs
 * Lê VIOS_TOKEN do .env.local na raiz do projeto.
 */
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const token = process.env.VIOS_TOKEN?.trim();
if (!token) {
  console.error("VIOS_TOKEN não encontrado em .env.local");
  process.exit(1);
}

const bearer = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
const hoje = new Date();
const inicio = new Date(hoje);
inicio.setDate(inicio.getDate() - 7);
const fim = new Date(hoje);
fim.setDate(fim.getDate() + 30);
const fmt = (d) => d.toISOString().slice(0, 10);

const qs = new URLSearchParams({
  data_limite_inicial: fmt(inicio),
  data_limite_final: fmt(fim),
});

const url = `https://bp.vios.com.br/api/integracoes/bp/tarefas?${qs}`;
const res = await fetch(url, {
  headers: {
    accept: "application/json",
    "Authorization-Vios": bearer,
  },
});

const body = await res.text();
console.log("Status:", res.status);
if (res.ok) {
  const data = JSON.parse(body);
  console.log("Tarefas:", Array.isArray(data) ? data.length : typeof data);
  if (Array.isArray(data) && data[0]) {
    console.log("Exemplo:", JSON.stringify(data[0], null, 2).slice(0, 600));
  }
} else {
  console.log("Erro:", body.slice(0, 400));
}
