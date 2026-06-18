/** Domínios corporativos equivalentes (mesmo colaborador). */
export const DOMINIOS_ESCRITORIO = [
  "bpplaw.com.br",
  "bismarchipires.com.br",
] as const;

const DOMINIO_CANONICO = "bismarchipires.com.br";

function parseEmail(email: string): { local: string; domain: string } | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return null;
  return { local: e.slice(0, at), domain: e.slice(at + 1) };
}

function isDominioEscritorio(domain: string): boolean {
  return (DOMINIOS_ESCRITORIO as readonly string[]).includes(domain);
}

/** Chave canônica para comparar e-mails do escritório (independente do domínio). */
export function normalizeEscritorioEmail(email: string): string {
  const parsed = parseEmail(email);
  if (!parsed) return email.trim().toLowerCase();
  if (isDominioEscritorio(parsed.domain)) {
    return `${parsed.local}@${DOMINIO_CANONICO}`;
  }
  return `${parsed.local}@${parsed.domain}`;
}

/** Variantes do mesmo endereço (bpplaw ↔ bismarchipires). */
export function variantesEmailEscritorio(email: string): string[] {
  const parsed = parseEmail(email);
  if (!parsed) return [email.trim().toLowerCase()];

  const out = new Set<string>();
  out.add(`${parsed.local}@${parsed.domain}`);
  if (isDominioEscritorio(parsed.domain)) {
    for (const d of DOMINIOS_ESCRITORIO) {
      out.add(`${parsed.local}@${d}`);
    }
  }
  return [...out];
}

export function emailsEscritorioIguais(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return normalizeEscritorioEmail(a) === normalizeEscritorioEmail(b);
}

/** True se o e-mail é de um domínio do escritório (@bpplaw / @bismarchipires). */
export function isEmailEscritorio(email: string): boolean {
  const parsed = parseEmail(email);
  return parsed ? isDominioEscritorio(parsed.domain) : false;
}

/** Registra valor no mapa para todas as variantes do e-mail. */
export function registrarEmailNoMapa<T>(
  mapa: Map<string, T>,
  email: string,
  valor: T
) {
  for (const v of variantesEmailEscritorio(email)) {
    mapa.set(v.toLowerCase(), valor);
  }
}

export function buscarNoMapaPorEmail<T>(
  mapa: Map<string, T>,
  email: string
): T | undefined {
  for (const v of variantesEmailEscritorio(email)) {
    const hit = mapa.get(v.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export function emailExisteNoMapa(mapa: Map<string, unknown>, email: string) {
  return buscarNoMapaPorEmail(mapa, email) !== undefined;
}
