import "server-only";

/**
 * Endereço do SAMA para links e imagens que saem por e-mail. Vem da
 * configuração, nunca do pedido (um cabeçalho forjado mandaria o link para
 * outro site). Na Vercel, sem NEXT_PUBLIC_APP_URL de produção, usa o domínio
 * de produção do projeto.
 */
export function urlBaseApp(): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurada && !/localhost|127\.0\.0\.1/.test(configurada)) {
    return configurada.replace(/\/$/, "");
  }
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (process.env.VERCEL_ENV === "production" && producao) return `https://${producao}`;
  const deploy = process.env.VERCEL_URL?.trim();
  if (deploy) return `https://${deploy}`;
  return (configurada || "http://localhost:3000").replace(/\/$/, "");
}
