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

const res = await fetch(`${base}/api/v1/recordings`, {
  method: "POST",
  headers: { "X-API-KEY": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    filters: { title: "Acompanhamento Cobranças" },
    include: { transcript: false, ai_notes: false },
    media_url: { expire_in: 43200 },
    pagination: { page_size: 1 },
  }),
});
const r = (await res.json())?.recordings?.data?.[0];
console.log("media_url:", r?.media_url ?? "(null)");
console.log("note_id:", r?.note_id);
console.log("id:", r?.id);

if (r?.id) {
  const one = await fetch(`${base}/api/v1/recording/${r.id}`, {
    headers: { "X-API-KEY": key },
  });
  const oneData = await one.json();
  console.log("GET by id media_url:", oneData?.recording?.media_url ?? "(null)");
}
