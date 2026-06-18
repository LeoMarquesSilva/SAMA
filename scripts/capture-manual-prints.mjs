/**
 * Captura screenshots do manual do SAMA (docs/manual-socio.md).
 * Requer: dev server rodando, .env.local com Supabase service role.
 *
 * Uso: node scripts/capture-manual-prints.mjs
 *
 * Ordem: todas as visões desktop primeiro, mobile por último.
 * Usuário padrão: controladoria@bismarchipires.com.br (não admin).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "manual");

const CAPTURE_EMAIL =
  process.env.MANUAL_CAPTURE_EMAIL ??
  "controladoria@bismarchipires.com.br";

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

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const val = m[2].replace(/^"|"$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

async function saveShot(buffer, slug) {
  const webp = await sharp(buffer).webp({ quality: 88 }).toBuffer();
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.webp`), webp);
  console.log(`  ✓ ${slug}.webp`);
}

async function shotPage(page, slug, opts = {}) {
  const { fullPage = false, selector = null, clip = null } = opts;
  await page.waitForTimeout(450);
  let buffer;
  if (selector) {
    const el = page.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    buffer = await el.screenshot({ type: "png" }).catch(async () =>
      page.screenshot({ fullPage, type: "png" })
    );
  } else if (clip) {
    buffer = await page.screenshot({ clip, type: "png" });
  } else {
    buffer = await page.screenshot({ fullPage, type: "png" });
  }
  await saveShot(buffer, slug);
}

async function createAuthenticatedContext(
  browser,
  baseUrl,
  supabase,
  contextOpts = {}
) {
  const email = CAPTURE_EMAIL;
  const viewport = contextOpts.viewport ?? DESKTOP_VIEWPORT;
  const { viewport: _v, ...restOpts } = contextOpts;

  if (process.env.MANUAL_CAPTURE_PASSWORD) {
    const context = await browser.newContext({ viewport, ...restOpts });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(
      process.env.MANUAL_CAPTURE_PASSWORD
    );
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(calendario|dashboard|trocar-senha)/, {
      timeout: 60000,
    });
    await page.close();
    return context;
  }

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink(
    {
      type: "magiclink",
      email,
      options: { redirectTo: `${baseUrl}/calendario` },
    }
  );
  if (linkErr) throw linkErr;

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: auth, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (otpErr || !auth.session) {
    throw otpErr ?? new Error("Sessão não criada via OTP.");
  }

  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    "."
  )[0];
  const host = new URL(baseUrl).hostname;
  const context = await browser.newContext({ viewport, ...restOpts });
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify(auth.session),
      domain: host,
      path: "/",
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function ensureAuthenticated(page, baseUrl) {
  await page.goto(`${baseUrl}/calendario`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    throw new Error(
      "Sessão não aplicada. Defina MANUAL_CAPTURE_PASSWORD no .env.local ou verifique cookies."
    );
  }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const fechar = page.getByRole("button", {
      name: /fechar|continuar|entendi|pular|começar a usar|concluir tour/i,
    });
    if (!(await fechar.count())) break;
    await fechar.first().click().catch(() => {});
    await page.waitForTimeout(350);
  }
}

async function expandSidebar(page) {
  await page.evaluate(() => {
    const aside = document.querySelector("aside.group");
    if (!aside) return;
    aside.style.width = "256px";
    aside.style.boxShadow = "0 20px 25px -5px rgb(15 23 42 / 0.08)";
    aside.querySelectorAll("*").forEach((el) => {
      const cls = el.className;
      if (typeof cls !== "string") return;
      if (cls.includes("opacity-0")) el.style.opacity = "1";
      if (cls.includes("group-hover:opacity-100")) el.style.opacity = "1";
      if (cls.includes("group-hover:inline-flex")) {
        el.style.display = "inline-flex";
      }
      if (cls.includes("group-hover:hidden")) {
        el.style.display = "none";
      }
    });
  });
  await page.waitForTimeout(400);
}

async function resetCalendarioFilters(page, baseUrl) {
  await page.goto(`${baseUrl}/calendario`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  const todos = page.getByRole("button", { name: /^todos$/i });
  if (await todos.count()) {
    await todos.first().click();
    await page.waitForTimeout(450);
  }
  const calTab = page.getByRole("tab", { name: /^calendário$/i });
  if (await calTab.count()) {
    await calTab.click();
    await page.waitForTimeout(450);
  }
}

async function safeCapture(page, slug, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`  ⚠ ${slug}: ${err.message?.slice(0, 80)}`);
    await shotPage(page, slug, { selector: "main" }).catch(() => {});
  }
}

function chipCalendario(page, cor) {
  return page.locator(`main button[class*="${cor}"]`).first();
}

async function captureDesktopPrints(page, baseUrl) {
  // 02 — Trocar senha
  {
    const p2 = await page.context().newPage();
    await p2.goto(`${baseUrl}/trocar-senha`, { waitUntil: "domcontentloaded" });
    await shotPage(p2, SLUGS[1], { selector: "main" });
    await p2.close();
  }

  // 03 — Alertas ao login
  await page.goto(`${baseUrl}/calendario`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await dismissOverlays(page);
  const overlay = page.locator('[role="dialog"], .fixed.inset-0').first();
  if (await overlay.isVisible().catch(() => false)) {
    await shotPage(page, SLUGS[2], {
      selector: '[role="dialog"], .fixed.inset-0',
    });
    await dismissOverlays(page);
  } else {
    await shotPage(page, SLUGS[2], { selector: "main" });
  }

  // 04 — Sidebar expandida (labels visíveis)
  await page.goto(`${baseUrl}/calendario`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await expandSidebar(page);
  await shotPage(page, SLUGS[3], { selector: "aside.group" });

  // 06 — Calendário mensal
  await page.goto(`${baseUrl}/calendario`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await shotPage(page, SLUGS[5], { selector: "main" });

  // 07 — Botão Atualizar
  const atualizar = page.getByRole("button", { name: /atualizar/i });
  if (await atualizar.count()) {
    await shotPage(page, SLUGS[6], {
      selector: 'button:has-text("Atualizar")',
    });
  }

  // 08 — Chip pendente
  const chipPendenteVis = chipCalendario(page, "bg-amber");
  if (await chipPendenteVis.count()) {
    await shotPage(page, SLUGS[7], {
      selector: 'main button[class*="bg-amber"]',
    });
  } else {
    await shotPage(page, SLUGS[7], { selector: "main" });
  }

  // 09 — Filtro não categorizados
  await safeCapture(page, SLUGS[8], async () => {
    const filtroNaoCat = page.getByRole("button", {
      name: /não categorizados/i,
    });
    if (await filtroNaoCat.count()) {
      await filtroNaoCat.first().click();
      await page.waitForTimeout(500);
    }
    await shotPage(page, SLUGS[8], { selector: "main" });
  });

  // 10 — Toggle lista/calendário
  const toggleCal = page.locator('[aria-label="Modo de visualização"]');
  if (await toggleCal.count()) {
    await shotPage(page, SLUGS[9], {
      selector: '[aria-label="Modo de visualização"]',
    });
  }

  // 11 — Visão lista
  const btnLista = page.getByRole("tab", { name: /^lista$/i });
  if (await btnLista.count()) {
    await btnLista.click();
    await page.waitForTimeout(600);
    await shotPage(page, SLUGS[10], { selector: "main" });
  } else {
    await shotPage(page, SLUGS[10], { selector: "main" });
  }

  // 12–20 — Sheet / formulários (visão calendário — chips coloridos)
  await resetCalendarioFilters(page, baseUrl);
  await page.waitForTimeout(500);

  const cardPendente = chipCalendario(page, "bg-amber");
  if (await cardPendente.count()) {
    await cardPendente.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    const sheet = page.locator('[role="dialog"], .fixed.inset-0').last();
    if (await sheet.isVisible().catch(() => false)) {
      await shotPage(page, SLUGS[11], {
        selector: '[role="dialog"], .fixed.inset-0',
      });
      await shotPage(page, SLUGS[12], {
        selector: '[role="dialog"], .fixed.inset-0',
      });

      const btnReuniao = page.getByRole("button", {
        name: /reclassificação reunião/i,
      });
      const btnAtividade = page.getByRole("button", {
        name: /reclassificação atividade/i,
      });

      if (await btnReuniao.count()) {
        await shotPage(page, SLUGS[13], {
          selector: '[role="dialog"], .fixed.inset-0',
        });

        if (await btnAtividade.count()) {
          await btnAtividade.click();
          await page.waitForTimeout(900);
          await shotPage(page, SLUGS[19], { selector: '[role="dialog"]' });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(400);
          await cardPendente.click().catch(() => {});
          await page.waitForTimeout(600);
        }

        await btnReuniao.click();
        await page.waitForTimeout(1000);
        await shotPage(page, SLUGS[14], { selector: '[role="dialog"]' });
        await shotPage(page, SLUGS[15], { selector: '[role="dialog"]' });
        await shotPage(page, SLUGS[16], { selector: '[role="dialog"]' });
        await shotPage(page, SLUGS[17], { selector: '[role="dialog"]' });
        await shotPage(page, SLUGS[18], { selector: '[role="dialog"]' });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }
    }
  } else {
    console.warn("  ⚠ Nenhum evento pendente — capturas 12–20 com fallback");
    for (const slug of SLUGS.slice(11, 20)) {
      await shotPage(page, slug, { selector: "main" });
    }
  }

  // 21–23 — Reunião categorizada / reverter (visão calendário)
  await resetCalendarioFilters(page, baseUrl);
  await page.waitForTimeout(500);
  const chipReuniao = chipCalendario(page, "bg-emerald");
  if (await chipReuniao.count()) {
    await chipReuniao.click().catch(() => {});
    await page.waitForTimeout(900);
    await shotPage(page, SLUGS[20], { selector: '[role="dialog"]' });
    await shotPage(page, SLUGS[22], { selector: '[role="dialog"]' });
    await page.keyboard.press("Escape");
  }

  const chipIgnorado = page.locator('main button[class*="bg-slate-3"]').first();
  if (await chipIgnorado.count()) {
    await chipIgnorado.click().catch(() => {});
    await page.waitForTimeout(700);
    await shotPage(page, SLUGS[21], {
      selector: '[role="dialog"], article',
    });
  } else {
    await shotPage(page, SLUGS[21], { selector: "main" });
  }

  // 24–26 — Próximos passos
  await page.goto(`${baseUrl}/proximos-passos`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await shotPage(page, SLUGS[23], { selector: "main" });
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) {
    await shotPage(page, SLUGS[24], { selector: "main" });
  }
  const expandBtn = page
    .getByRole("button")
    .filter({ hasText: /reunião|comitê|1:1/i })
    .first();
  if (await expandBtn.count()) {
    await expandBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    await shotPage(page, SLUGS[25], { selector: "main" });
  }

  // 27–30 — Dashboard
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await shotPage(page, SLUGS[26], { selector: "main" });
  const periodo = page
    .getByRole("button", { name: /este mês|3 meses|6 meses/i })
    .first();
  if (await periodo.count()) {
    await shotPage(page, SLUGS[27], {
      clip: { x: 0, y: 0, width: 1280, height: 220 },
    });
  }
  const tipoFiltro = page
    .locator('[data-onboarding="dashboard-filtros"] button')
    .filter({ hasText: /todos os tipos/i })
    .first();
  if (await tipoFiltro.count()) {
    await shotPage(page, SLUGS[28], {
      selector: '[data-onboarding="dashboard-filtros"]',
    });
  }
  const cardTipo = page
    .locator("a, button")
    .filter({ hasText: /captação|gestão|fidelização/i })
    .first();
  if (await cardTipo.count()) {
    await shotPage(page, SLUGS[29], { selector: "main" });
  }
}

async function captureMobileNav(baseUrl, desktopContext) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const cookies = await desktopContext.cookies();
  const mobileContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  if (cookies.length) {
    await mobileContext.addCookies(cookies);
  }

  const mp = await mobileContext.newPage();
  await mp.goto(`${baseUrl}/calendario`, { waitUntil: "networkidle" });
  await dismissOverlays(mp);
  await mp.waitForTimeout(800);

  const bottomNav = mp.locator(
    "nav.fixed.inset-x-0.bottom-0.md\\:hidden"
  );
  await bottomNav.waitFor({ state: "visible", timeout: 15000 });
  await shotPage(mp, SLUGS[4], {
    selector: "nav.fixed.inset-x-0.bottom-0.md\\:hidden",
  });

  await browser.close();
}

async function main() {
  loadEnv();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = await import("playwright");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Capturando prints do manual (${CAPTURE_EMAIL})…\n`);

  // 01 — Login (sem autenticação)
  {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: DESKTOP_VIEWPORT });
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="email"]').fill(CAPTURE_EMAIL);
    await shotPage(page, SLUGS[0], { selector: "main" });
    await browser.close();
  }

  const browser = await chromium.launch();
  const context = await createAuthenticatedContext(
    browser,
    baseUrl,
    supabase,
    { viewport: DESKTOP_VIEWPORT }
  );
  const page = await context.newPage();

  await ensureAuthenticated(page, baseUrl);
  await captureDesktopPrints(page, baseUrl);

  console.log("\nCapturas desktop concluídas. Iniciando mobile…\n");
  await captureMobileNav(baseUrl, context);

  await browser.close();

  const missing = SLUGS.filter(
    (s) => !fs.existsSync(path.join(OUT_DIR, `${s}.webp`))
  );
  if (missing.length) {
    console.warn("\nFaltando:", missing.join(", "));
  }
  console.log(
    `\nConcluído — ${SLUGS.length - missing.length}/${SLUGS.length} em public/manual/`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
