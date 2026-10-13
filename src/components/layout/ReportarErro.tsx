"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ReportarErroCtx, useReportarErro } from "@/components/ui/reportar-contexto";
import { capturarTela } from "@/lib/capturar-tela";
import { reportarErroSama, type ReportarErroResult } from "@/lib/reportar-erro";

/**
 * "Reportar" do SAMA: abre chamado direto na Responsum com o print de onde a
 * pessoa está, como o botão do SIOE. Fica no layout para funcionar também por
 * cima dos modais (o botão de cada modal chama `abrir` com o próprio painel).
 */
export function ReportarErroProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [print, setPrint] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string | null>(null);
  const capturaAtual = useRef(0);

  // A confirmação fica no cabeçalho por alguns segundos e some.
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 8000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const abrir = useCallback((alvo?: HTMLElement | null) => {
    setTitulo("");
    setDescricao("");
    setErro(undefined);
    setAviso(null);
    setPrint(null);
    setCapturando(true);
    setAberto(true);
    const id = ++capturaAtual.current;
    // Deixa o modal aparecer antes; a cópia dos estilos ocupa o navegador por um instante.
    window.setTimeout(() => {
      void capturarTela(alvo).then((png) => {
        if (capturaAtual.current !== id) return;
        setPrint(png);
        setCapturando(false);
      });
    }, 50);
  }, []);

  function fechar() {
    if (enviando) return;
    capturaAtual.current++;
    setAberto(false);
  }

  async function enviar() {
    setEnviando(true);
    setErro(undefined);
    const r = await reportarErroSama({
      titulo,
      descricao,
      rota: pathname,
      print,
    })
      .catch((): ReportarErroResult => ({ ok: false, error: "Falha de conexão ao criar o chamado." }))
      .finally(() => setEnviando(false));
    if (!r.ok) {
      setErro(r.error ?? "Falha ao criar o chamado.");
      return;
    }
    const destino = r.responsavel ? ` Encaminhado para ${r.responsavel}.` : "";
    const semPrint = r.semPrint ? " O print não foi anexado." : "";
    setAviso(`Chamado aberto na Responsum.${destino}${semPrint}`);
    setAberto(false);
  }

  const contexto = useMemo(() => ({ abrir, aviso }), [abrir, aviso]);

  return (
    <ReportarErroCtx.Provider value={contexto}>
      {children}
      <Modal
        open={aberto}
        onClose={fechar}
        title="Reportar no Responsum"
        closeDisabled={enviando}
        camada="reporte"
        semReportar
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Abre um chamado em Manutenção em Sistemas, na subcategoria SAMA, com o print desta tela.
          </p>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={enviando}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">O que aconteceu?</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={enviando}
              rows={6}
              className="block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {capturando ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Capturando o print…
              </span>
            ) : print ? (
              <div className="space-y-2">
                <p className="font-medium text-slate-700">Print da tela</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado no navegador */}
                <img
                  src={print}
                  alt="Prévia do print"
                  className="max-h-40 w-full rounded border border-slate-200 bg-white object-contain"
                />
              </div>
            ) : (
              <p>Não foi possível capturar o print. O chamado segue sem ele.</p>
            )}
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={enviando} onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={enviando || capturando || !titulo.trim() || !descricao.trim()}
              onClick={() => void enviar()}
            >
              {enviando ? "Enviando…" : "Criar chamado"}
            </Button>
          </div>
        </div>
      </Modal>
    </ReportarErroCtx.Provider>
  );
}

/** Botão do cabeçalho: print do conteúdo da página. */
export function ReportarErroButton() {
  const reportar = useReportarErro();
  if (!reportar) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => reportar.abrir()}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Reportar no Responsum"
      >
        <Bug size={16} />
        <span className="hidden sm:inline">Reportar</span>
      </button>
      {reportar.aviso && (
        <span className="hidden max-w-48 truncate text-xs text-emerald-700 lg:inline">
          {reportar.aviso}
        </span>
      )}
    </>
  );
}
