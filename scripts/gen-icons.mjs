// Gera os PNGs do PWA a partir de public/icon.svg.
// Uso: node scripts/gen-icons.mjs  (requer sharp instalado)
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public", "icon.svg"));

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180, bg: "#2447d0" },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12, bg: "#2447d0" },
];

for (const t of targets) {
  let img = sharp(svg, { density: 512 }).resize(t.size, t.size);
  if (t.pad) {
    const inner = Math.round(t.size * (1 - t.pad * 2));
    img = sharp(svg, { density: 512 })
      .resize(inner, inner)
      .extend({
        top: Math.round((t.size - inner) / 2),
        bottom: Math.round((t.size - inner) / 2),
        left: Math.round((t.size - inner) / 2),
        right: Math.round((t.size - inner) / 2),
        background: t.bg,
      });
  }
  if (t.bg) img = img.flatten({ background: t.bg });
  await img.png().toFile(join(root, "public", t.file));
  console.log("gerado:", t.file);
}
