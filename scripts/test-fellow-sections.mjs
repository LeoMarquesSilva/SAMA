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
    filters: { title: "Movent" },
    include: { transcript: true, ai_notes: true },
    pagination: { page_size: 5 },
  }),
});
const items = (await res.json())?.recordings?.data ?? [];
for (const r of items) {
  console.log("\n===", r.title, "===");
  const recap = r.ai_notes?.find((n) => n.is_active) ?? r.ai_notes?.[0];
  for (const s of recap?.sections ?? []) {
    console.log("SECTION:", s.title, "| type:", s.type);
    console.log("content:", JSON.stringify(s.content).slice(0, 400));
  }
}
