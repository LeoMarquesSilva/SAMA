/**
 * Teste pontual: Reunião Movent no Fellow.
 * Uso: node scripts/test-fellow-movent.mjs
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

const base = process.env.FELLOW_API_URL?.replace(/\/$/, "");
const key = process.env.FELLOW_API_KEY?.trim();
const headers = { "X-API-KEY": key, "Content-Type": "application/json" };

async function listRecordings(filters) {
  const res = await fetch(`${base}/api/v1/recordings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filters,
      include: { transcript: true, ai_notes: true },
      pagination: { page_size: 5 },
    }),
  });
  console.log("POST recordings", JSON.stringify(filters), "→", res.status);
  if (!res.ok) {
    console.log(await res.text().then((t) => t.slice(0, 300)));
    return [];
  }
  const data = await res.json();
  return data?.recordings?.data ?? [];
}

console.log("Workspace:", base);
console.log("---\n");

const porTitulo = await listRecordings({ title: "Movent" });
console.log("Por título 'Movent':", porTitulo.length);
for (const r of porTitulo) {
  console.log({
    id: r.id,
    title: r.title,
    started_at: r.started_at,
    event_guid: r.event_guid,
    media_url: r.media_url ? "sim" : "não",
    transcript: r.transcript?.speech_segments?.length ?? 0,
    ai_notes: r.ai_notes?.length ?? 0,
  });
  if (r.transcript?.speech_segments?.[0]) {
    const s = r.transcript.speech_segments[0];
    console.log("  1º trecho:", `${s.speaker}: ${s.text?.slice(0, 80)}`);
  }
}

// outlook_event_id do SAMA se existir
const outlookFromArgs = process.argv[2];
if (outlookFromArgs) {
  console.log("\n---\nPor event_guid do SAMA:");
  const porEvento = await listRecordings({ event_guid: outlookFromArgs });
  console.log("Encontradas:", porEvento.length);
  for (const r of porEvento) {
    console.log("-", r.title, r.started_at);
  }
}
