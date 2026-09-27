/** O site do escritório está fora do ar; essas URLs quebram no navegador. */
export function urlDeFotoUtil(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "bismarchipires.com.br" || host.endsWith(".bismarchipires.com.br")) {
      return null;
    }
  } catch {
    return null;
  }
  return url;
}
