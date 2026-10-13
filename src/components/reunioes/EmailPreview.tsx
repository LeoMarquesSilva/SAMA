"use client";

import { useDeferredValue, useEffect, useRef } from "react";
import { clsx } from "clsx";

/**
 * Prévia do e-mail como o cliente vai receber: cabeçalho (de, para, cc,
 * assunto) e o corpo num iframe, isolado do CSS do SAMA. O documento é
 * reescrito a cada mudança mantendo a rolagem, para acompanhar a digitação.
 */
export function EmailPreview({
  html,
  assunto,
  de,
  para,
  cc,
  className,
}: {
  html: string;
  assunto: string;
  de?: string | null;
  para: string[];
  cc: string[];
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlAdiado = useDeferredValue(html);

  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    const doc = iframeRef.current?.contentDocument;
    if (!win || !doc) return;
    const rolagem = win.scrollY;
    doc.open();
    doc.write(htmlAdiado);
    doc.close();
    win.scrollTo(0, rolagem);
  }, [htmlAdiado]);

  return (
    <div
      className={clsx(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white",
        className
      )}
    >
      <dl className="shrink-0 space-y-1 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs">
        {de ? <Linha rotulo="De" valor={de} /> : null}
        <Linha rotulo="Para" valor={para.join(", ") || "—"} />
        {cc.length > 0 ? <Linha rotulo="Cc" valor={cc.join(", ")} /> : null}
        <Linha rotulo="Assunto" valor={assunto} forte />
      </dl>
      {/* Sem allow-scripts: o HTML do e-mail não executa nada na prévia. */}
      <iframe
        ref={iframeRef}
        title="Prévia do e-mail"
        sandbox="allow-same-origin"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  forte,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-slate-400">{rotulo}</dt>
      <dd
        className={clsx(
          "min-w-0 break-words",
          forte ? "font-semibold text-slate-800" : "text-slate-600"
        )}
      >
        {valor}
      </dd>
    </div>
  );
}
