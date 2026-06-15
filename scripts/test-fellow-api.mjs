/**
 * Teste rápido da API Fellow. Uso: node scripts/test-fellow-api.mjs
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
if (!base || !key) {
  console.error("FELLOW_API_URL e FELLOW_API_KEY são obrigatórios em .env.local");
  process.exit(1);
}

const headers = { "X-API-KEY": key, "Content-Type": "application/json" };

const meRes = await fetch(`${base}/api/v1/me`, { headers: { "X-API-KEY": key } });
console.log("GET /api/v1/me →", meRes.status);
if (meRes.ok) {
  const me = await meRes.json();
  console.log("Usuário:", me.user?.email ?? me.email ?? JSON.stringify(me).slice(0, 200));
}

const eventGuid =
  "AAMkADAzNmUyYzUyLTZiNTktNGVjMy1hNTJkLThhNmViZGZkOWIxZQFRAAgI3sA548IAAEYAAAAAwKG0z6W7F0yvLUHFuMuKxwcA4XD2hMOmW0q3uAexQ3Xn6gAAAAABDQAA4XD2hMOmW0q3uAexQ3Xn6gAERZ8FLQAAEA==";

const recRes = await fetch(`${base}/api/v1/recordings`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    filters: { event_guid: eventGuid },
    include: { transcript: true, ai_notes: true },
    pagination: { page_size: 5 },
  }),
});
console.log("\nPOST /api/v1/recordings (event_guid) →", recRes.status);
const recData = await recRes.json();
const items = recData?.recordings?.data ?? [];
console.log("Gravações encontradas:", items.length);

for (const r of items) {
  console.log("\n—", r.title);
  console.log("  id:", r.id);
  console.log("  event_guid:", r.event_guid?.slice(0, 60) + "...");
  console.log("  started_at:", r.started_at);
  console.log("  media_url:", r.media_url ? "sim" : "não");
  console.log("  transcript segments:", r.transcript?.speech_segments?.length ?? 0);
  console.log("  ai_notes:", r.ai_notes?.length ?? 0);
  const first = r.transcript?.speech_segments?.[0];
  if (first) console.log("  1º segmento:", `${first.speaker}: ${first.text?.slice(0, 80)}`);
}

if (items.length === 0) {
  const recentRes = await fetch(`${base}/api/v1/recordings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filters: { created_at_start: "2026-05-01" },
      pagination: { page_size: 10 },
    }),
  });
  console.log("\nFallback — gravações desde 2026-05-01 →", recentRes.status);
  if (recentRes.ok) {
    const recentData = await recentRes.json();
    for (const r of recentData?.recordings?.data ?? []) {
      console.log("-", r.title, "|", r.started_at, "| event_guid:", r.event_guid ? "sim" : "não");
    }
  }

  const notesRes = await fetch(`${base}/api/v1/notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filters: { event_guid: eventGuid },
      include: { content_markdown: true },
      pagination: { page_size: 5 },
    }),
  });
  console.log("\nPOST /api/v1/notes (event_guid) →", notesRes.status);
  if (notesRes.ok) {
    const notesData = await notesRes.json();
    const notes = notesData?.notes?.data ?? notesData?.data ?? [];
    console.log("Notas encontradas:", notes.length);
    for (const n of notes) {
      console.log("-", n.title, "| recording_ids:", n.recording_ids?.length ?? 0);
    }
  }

  const sampleRes = await fetch(`${base}/api/v1/recordings`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filters: { title: "Reunião Prifer" },
      include: { transcript: true, ai_notes: true },
      pagination: { page_size: 1 },
    }),
  });
  console.log("\nAmostra com transcrição (Reunião Prifer) →", sampleRes.status);
  if (sampleRes.ok) {
    const sample = (await sampleRes.json())?.recordings?.data?.[0];
  if (sample) {
    console.log("  media_url:", sample.media_url ? "sim" : "não");
    console.log("  transcript segments:", sample.transcript?.speech_segments?.length ?? 0);
    console.log("  ai_notes:", sample.ai_notes?.length ?? 0);
    const seg = sample.transcript?.speech_segments?.[0];
    if (seg) console.log("  amostra:", `${seg.speaker}: ${seg.text?.slice(0, 100)}`);
    if (sample.ai_notes?.[0]) {
      console.log("\n  ai_notes sections:");
      for (const s of sample.ai_notes[0].sections ?? []) {
        console.log("   -", s.title, "| type:", s.type);
      }
    }
  }
}
}
