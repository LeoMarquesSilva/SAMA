/**
 * Print simples do que a pessoa está vendo (o conteúdo da página ou o modal
 * aberto), em PNG sem fundo. Mesmo caminho do "Reportar Erro" do SIOE: clona o
 * elemento, copia os estilos calculados e desenha num canvas via
 * SVG/foreignObject. Só roda no navegador.
 */

const XHTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

/** Teto do data URL (base64) para caber no envio ao servidor. */
export const LIMITE_PRINT_CHARS = 3_000_000;
const ESCALAS = [1.25, 0.85, 0.6];

type Area = { top: number; bottom: number; left: number; right: number };

/** Todos os estilos calculados num só cssText (bem mais rápido que setProperty um a um). */
function estiloInline(calculado: CSSStyleDeclaration): string {
  let css = "";
  for (let i = 0; i < calculado.length; i++) {
    const prop = calculado[i];
    let valor = calculado.getPropertyValue(prop);
    // A fonte da página não carrega dentro do SVG: sem reserva, o print sai em Times.
    if (prop === "font-family") valor += ", Arial, sans-serif";
    css += `${prop}:${valor};`;
  }
  return css;
}

function estilizavel(el: Element): el is HTMLElement | SVGElement {
  return el instanceof HTMLElement || el instanceof SVGElement;
}

/**
 * No SVG não existe rolagem: troca auto/scroll por hidden e, se havia barra,
 * guarda o espaço dela para o conteúdo não mudar de largura.
 */
function prenderRolagem(origem: Element, calculado: CSSStyleDeclaration, destino: HTMLElement | SVGElement) {
  if (!/auto|scroll/.test(`${calculado.overflowX} ${calculado.overflowY}`)) return;
  destino.style.setProperty("overflow", "hidden");
  if (origem instanceof HTMLElement) {
    const bordas = parseFloat(calculado.borderLeftWidth) + parseFloat(calculado.borderRightWidth);
    if (origem.offsetWidth - origem.clientWidth - bordas > 0) {
      destino.style.setProperty("scrollbar-gutter", "stable");
    }
  }
}

/**
 * Um bloco inteiro fora da área visível vira só a caixa (largura e altura em px
 * vêm nos estilos), sem os filhos: o print sai igual e páginas longas não
 * travam o navegador.
 */
function podar(filho: Element, clone: Element, area: Area): boolean {
  if (!(filho instanceof HTMLElement) || !(clone instanceof HTMLElement)) return false;
  const calculado = window.getComputedStyle(filho);
  if (calculado.display === "inline" || calculado.display === "contents") return false;
  const r = filho.getBoundingClientRect();
  const fora =
    r.bottom < area.top || r.top > area.bottom || r.right < area.left || r.left > area.right;
  if (!fora || r.width <= 0) return false;
  clone.style.cssText = `${estiloInline(calculado)}visibility:hidden;`;
  clone.replaceChildren();
  return true;
}

/** Copia os estilos calculados do original para o clone, inclusive a rolagem. */
function copiarEstilos(origem: Element, destino: Element, area: Area) {
  if (!estilizavel(origem) || !estilizavel(destino)) return;
  const calculado = window.getComputedStyle(origem);
  destino.style.cssText = estiloInline(calculado);
  prenderRolagem(origem, calculado, destino);
  const { scrollLeft, scrollTop } = origem;
  const filhos = Array.from(origem.children);
  const clones = Array.from(destino.children);
  filhos.forEach((filho, i) => {
    const clone = clones[i];
    if (!clone) return;
    if (!podar(filho, clone, area)) copiarEstilos(filho, clone, area);
    // Quem rolou: o conteúdo anda junto, como no scroll de verdade.
    if ((scrollLeft || scrollTop) && estilizavel(clone)) {
      clone.style.setProperty("translate", `${-scrollLeft}px ${-scrollTop}px`);
    }
  });
}

/** O clone não leva o que foi digitado: passa os valores para os atributos. */
function copiarValores(origem: HTMLElement, destino: HTMLElement) {
  const deOrigem = origem.querySelectorAll("input, textarea, select");
  const deDestino = destino.querySelectorAll("input, textarea, select");
  deOrigem.forEach((el, i) => {
    const alvo = deDestino[i];
    if (!alvo) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked) alvo.setAttribute("checked", "");
        else alvo.removeAttribute("checked");
      } else {
        alvo.setAttribute("value", el.value);
      }
    } else if (el instanceof HTMLTextAreaElement) {
      alvo.textContent = el.value;
    } else if (el instanceof HTMLSelectElement && alvo instanceof HTMLSelectElement) {
      Array.from(alvo.options).forEach((opcao, j) => {
        if (el.options[j]?.selected) opcao.setAttribute("selected", "");
        else opcao.removeAttribute("selected");
      });
    }
  });
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error ?? new Error("Falha ao ler imagem."));
    leitor.readAsDataURL(blob);
  });
}

/** Imagem externa não carrega dentro do SVG: embute como data URL ou tira. */
async function embutirImagens(raiz: HTMLElement) {
  const imagens = Array.from(raiz.querySelectorAll("img"));
  await Promise.all(
    imagens.map(async (img) => {
      const src = img.currentSrc || img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(new URL(src, window.location.href).href, {
          credentials: "same-origin",
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(String(res.status));
        img.setAttribute("src", await blobParaDataUrl(await res.blob()));
        img.removeAttribute("srcset");
      } catch {
        img.remove();
      }
    })
  );
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao montar o print."));
    img.src = src;
  });
}

async function desenhar(
  svg: string,
  largura: number,
  altura: number,
  escala: number
): Promise<string> {
  const img = await carregarImagem(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(largura * escala);
  canvas.height = Math.round(altura * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.scale(escala, escala);
  ctx.drawImage(img, 0, 0, largura, altura);
  return canvas.toDataURL("image/png");
}

/**
 * Data URL PNG do que está visível em `alvo` (ex.: o painel de um modal) ou,
 * sem alvo, no conteúdo da página. Null se falhar.
 */
export async function capturarTela(alvo?: HTMLElement | null): Promise<string | null> {
  try {
    const raiz =
      alvo ??
      document.querySelector<HTMLElement>("main[data-app-scroll]") ??
      document.querySelector<HTMLElement>("main");
    if (!raiz) return null;
    const calculado = window.getComputedStyle(raiz);
    // Área útil sem a barra de rolagem (o clone não tem barra).
    const largura =
      raiz.clientWidth + parseFloat(calculado.borderLeftWidth) + parseFloat(calculado.borderRightWidth);
    const altura =
      raiz.clientHeight + parseFloat(calculado.borderTopWidth) + parseFloat(calculado.borderBottomWidth);
    if (!largura || !altura) return null;

    const clone = raiz.cloneNode(true) as HTMLElement;
    // Valores antes da poda, enquanto os campos do clone ainda batem com os do original.
    copiarValores(raiz, clone);
    const r = raiz.getBoundingClientRect();
    copiarEstilos(raiz, clone, {
      top: Math.max(r.top, 0),
      bottom: Math.min(r.bottom, window.innerHeight),
      left: Math.max(r.left, 0),
      right: Math.min(r.right, window.innerWidth),
    });
    clone.querySelectorAll("script, noscript").forEach((n) => n.remove());
    await embutirImagens(clone);

    // A raiz vai para o canto do print, com o tamanho que tem na tela.
    for (const [prop, valor] of [
      ["position", "relative"],
      ["inset", "auto"],
      ["margin", "0"],
      ["transform", "none"],
      ["translate", "none"],
      ["box-sizing", "border-box"],
      ["width", `${largura}px`],
      ["height", `${altura}px`],
      ["min-width", "0"],
      ["min-height", "0"],
      ["max-width", "none"],
      ["max-height", "none"],
      ["overflow", "hidden"],
      ["scrollbar-gutter", "auto"],
    ]) {
      clone.style.setProperty(prop, valor);
    }

    const moldura = document.createElement("div");
    moldura.setAttribute("xmlns", XHTML_NS);
    moldura.style.cssText = `width:${largura}px;height:${altura}px;overflow:hidden;`;
    moldura.appendChild(clone);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("xmlns", SVG_NS);
    svg.setAttribute("width", String(largura));
    svg.setAttribute("height", String(altura));
    const objeto = document.createElementNS(SVG_NS, "foreignObject");
    objeto.setAttribute("width", "100%");
    objeto.setAttribute("height", "100%");
    objeto.appendChild(moldura);
    svg.appendChild(objeto);
    const serializado = new XMLSerializer().serializeToString(svg);

    for (const escala of ESCALAS) {
      const png = await desenhar(serializado, largura, altura, escala);
      if (png.length <= LIMITE_PRINT_CHARS) return png;
    }
    return null;
  } catch {
    return null;
  }
}
