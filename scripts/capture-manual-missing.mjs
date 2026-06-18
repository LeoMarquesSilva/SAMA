/** Completa prints faltantes sem refazer os existentes. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "manual");

const SLUGS = [
  "01-login",
  "02-trocar-senha",
  "03-alertas-login",
  "04-sidebar-desktop",
  "05-mobile-nav",
  "06-calendario-mensal",
  "07-botao-atualizar",
  "08-chip-nao-categorizado",
  "09-filtro-nao-categorizados",
  "10-toggle-lista-calendario",
  "11-visao-lista",
  "12-sheet-evento-pendente",
  "13-botao-ignorar",
  "14-botoes-reclassificacao",
  "15-cabecalho-outlook",
  "16-formulario-reuniao",
  "17-resumo-proximos-passos",
  "18-checklist-proximos-passos",
  "19-botao-salvar",
  "20-formulario-atividade",
  "21-reuniao-categorizada-edicao",
  "22-reverter-ignorado",
  "23-reverter-modal-rodape",
  "24-proximos-passos-tela",
  "25-checkbox-concluida",
  "26-editar-reuniao-passos",
  "27-dashboard-mes",
  "28-filtros-periodo",
  "29-filtro-tipo",
  "30-card-calendario",
];

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

async function saveShot(buffer, slug) {
  const webp = await sharp(buffer).webp({ quality: 86 }).toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.webp`), webp);
  console.log(`  ✓ ${slug}.webp`);
}

async function authContext(browser, baseUrl, supabase) {
  const email =
    process.env.MANUAL_CAPTURE_EMAIL ?? "leonardo@bismarchipires.com.br";
  const { data: link } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/calendario` },
  });
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: auth } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    "."
  )[0];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify(auth.session),
      domain: new URL(baseUrl).hostname,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  return ctx;
}

async function main() {
  loadEnv();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const missing = SLUGS.filter(
    (s) => !fs.existsSync(path.join(OUT_DIR, `${s}.webp`))
  );
  if (!missing.length) {
    console.log("Todos os prints já existem.");
    return;
  }
  console.log("Capturando faltantes:", missing.join(", "));

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const ctx = await authContext(browser, baseUrl, supabase);
  const page = await ctx.newPage();

  for (const slug of missing) {
    if (slug === "11-visao-lista") {
      await page.goto(`${baseUrl}/calendario`, { waitUntil: "load", timeout: 60000 });
      await page.getByRole("button", { name: /^lista$/i }).click().catch(() => {});
      await page.waitForTimeout(800);
      await saveShot(await page.locator("main").screenshot({ type: "png" }), slug);
      continue;
    }
    if (slug.startsWith("21") || slug.startsWith("22") || slug.startsWith("23")) {
      await page.goto(`${baseUrl}/calendario`, { waitUntil: "load", timeout: 60000 });
      const chip =
        slug === "21-reuniao-categorizada-edicao" ||
        slug === "23-reverter-modal-rodape"
          ? page.locator('main button[class*="bg-emerald"]').first()
          : page.locator('main button[class*="bg-slate-3"]').first();
      if (await chip.count()) await chip.click().catch(() => {});
      await page.waitForTimeout(900);
      const dialog = page.locator('[role="dialog"]').last();
      const buf = (await dialog.isVisible().catch(() => false))
        ? await dialog.screenshot({ type: "png" })
        : await page.locator("main").screenshot({ type: "png" });
      await saveShot(buf, slug);
      await page.keyboard.press("Escape").catch(() => {});
      continue;
    }
    if (slug.startsWith("24") || slug.startsWith("25") || slug.startsWith("26")) {
      await page.goto(`${baseUrl}/proximos-passos`, { waitUntil: "load", timeout: 60000 });
      await saveShot(await page.locator("main").screenshot({ type: "png" }), slug);
      continue;
    }
    if (slug.startsWith("27") || slug.startsWith("28") || slug.startsWith("29") || slug.startsWith("30")) {
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "load", timeout: 60000 });
      await saveShot(await page.locator("main").screenshot({ type: "png" }), slug);
    }
  }

  await browser.close();
}

main().catch(console.error);
