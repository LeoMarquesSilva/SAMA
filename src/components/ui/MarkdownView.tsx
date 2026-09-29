import { Fragment, type ReactNode } from "react";
import { clsx } from "clsx";
import { normalizarMarkdown } from "@/lib/markdown-editor";

type Bloco =
  | { tipo: "titulo"; nivel: number; texto: string }
  | { tipo: "divisor"; texto: string }
  | { tipo: "lista"; ordenada: boolean; itens: string[] }
  | { tipo: "paragrafo"; linhas: string[] };

const DIVISOR_RE = /^\s*[-—_*]{0,3}\s*(Última pauta do dia[^\n]*)$/i;
const TITULO_RE = /^\s*(#{1,4})\s+(.+)$/;
const TITULO_NEGRITO_RE = /^\s*\*\*([^*]+?)\*\*:?\s*$/;
const ITEM_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
const ORDENADO_RE = /^\s*\d+[.)]\s+/;

function blocos(md: string): Bloco[] {
  const out: Bloco[] = [];
  let paragrafo: string[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;

  const fecharParagrafo = () => {
    if (paragrafo.length) out.push({ tipo: "paragrafo", linhas: paragrafo });
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) out.push({ tipo: "lista", ...lista });
    lista = null;
  };

  for (const linha of normalizarMarkdown(md.replace(/\r\n/g, "\n")).split("\n")) {
    if (!linha.trim()) {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const div = linha.match(DIVISOR_RE);
    if (div) {
      fecharParagrafo();
      fecharLista();
      out.push({ tipo: "divisor", texto: div[1].trim() });
      continue;
    }
    const tit = linha.match(TITULO_RE) ?? null;
    const titNeg = tit ? null : linha.match(TITULO_NEGRITO_RE);
    if (tit || titNeg) {
      fecharParagrafo();
      fecharLista();
      out.push({
        tipo: "titulo",
        nivel: tit ? tit[1].length : 3,
        texto: (tit ? tit[2] : titNeg![1]).trim(),
      });
      continue;
    }
    const item = linha.match(ITEM_RE);
    if (item) {
      fecharParagrafo();
      const ordenada = ORDENADO_RE.test(linha);
      if (!lista || lista.ordenada !== ordenada) {
        fecharLista();
        lista = { ordenada, itens: [] };
      }
      lista.itens.push(item[1]);
      continue;
    }
    fecharLista();
    paragrafo.push(linha.trim());
  }
  fecharParagrafo();
  fecharLista();
  return out;
}

/** **negrito**, *itálico* e `código` como elementos React (sem HTML cru). */
function inline(texto: string): ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`)/g);
  return partes.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
      return <em key={i}>{p.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Leitura de markdown simples (títulos, listas, negrito/itálico, parágrafos). */
export function MarkdownView({
  texto,
  className,
}: {
  texto: string | null | undefined;
  className?: string;
}) {
  const lista = blocos(texto ?? "");
  if (!lista.length) return <p className="text-sm text-slate-400">—</p>;

  return (
    <div className={clsx("space-y-3 text-sm leading-relaxed text-slate-700", className)}>
      {lista.map((b, i) => {
        if (b.tipo === "divisor") {
          return (
            <div key={i} className="flex items-center gap-2 pt-1">
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                {b.texto}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          );
        }
        if (b.tipo === "titulo") {
          return (
            <p
              key={i}
              className={clsx(
                "font-semibold text-slate-900",
                b.nivel <= 1 ? "text-base" : "text-sm",
                i > 0 && "pt-1"
              )}
            >
              {inline(b.texto)}
            </p>
          );
        }
        if (b.tipo === "lista") {
          const Tag = b.ordenada ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={clsx(
                "space-y-1.5 pl-5",
                b.ordenada ? "list-decimal" : "list-disc marker:text-brand-400"
              )}
            >
              {b.itens.map((it, j) => (
                <li key={j} className="pl-1">
                  {inline(it)}
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i}>
            {b.linhas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
