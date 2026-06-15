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

const res = await fetch(`${base}/api/v1/recordings`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    filters: { created_at_start: "2026-05-01" },
    include: { transcript: false, ai_notes: true },
    pagination: { page_size: 50 },
  }),
});
const items = (await res.json())?.recordings?.data ?? [];
for (const r of items) {
  const recap = r.ai_notes?.find((n) => n.is_active) ?? r.ai_notes?.[0];
  const actions = recap?.sections?.find(
    (s) => s.title?.toLowerCase() === "action items"
  );
  if (Array.isArray(actions?.content) && actions.content.length > 0) {
    console.log("\n===", r.title, "===");
    console.log(JSON.stringify(actions.content, null, 2).slice(0, 1500));
  }
}
