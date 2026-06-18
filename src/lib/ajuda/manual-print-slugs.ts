/** Ordem dos [PRINT: …] em docs/manual-socio.md → arquivo em /public/manual/ */
export const MANUAL_PRINT_SLUGS = [
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
] as const;

export function manualPrintSrc(index: number): string | null {
  const slug = MANUAL_PRINT_SLUGS[index];
  if (!slug) return null;
  return `/manual/${slug}.webp`;
}

export function injectManualPrintImages(markdown: string): string {
  let index = 0;
  return markdown.replace(/\[PRINT:\s*([^\]]+)\]/g, (_match, caption: string) => {
    const src = manualPrintSrc(index);
    index += 1;
    if (!src) return _match;
    const alt = caption.trim().replace(/`/g, "");
    return `![${alt}](${src})`;
  });
}
