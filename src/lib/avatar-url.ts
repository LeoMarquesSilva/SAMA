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

/**
 * Miniatura redimensionada pelo Supabase Storage (render/image). As fotos originais
 * chegam a vários MB e aparecem com 18–40px; a miniatura fica com poucos KB.
 * Outras URLs voltam como estão.
 */
export function miniaturaDoAvatar(url: string, size: number): string {
  if (!url.includes("/storage/v1/object/public/")) return url;
  // Poucas larguras fixas (2x para telas retina) para reaproveitar o cache da CDN.
  const largura = size <= 32 ? 64 : size <= 48 ? 96 : 160;
  const base = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${largura}&height=${largura}&resize=cover&quality=75`;
}
