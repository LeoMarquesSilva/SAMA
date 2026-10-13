"use client";

import { Bug, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { Z } from "@/lib/zIndex";
import { useReportarErro } from "@/components/ui/reportar-contexto";

const panelSizes = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  "2xl": "sm:max-w-6xl",
} as const;

/** Modais abertos, do mais antigo ao mais recente: o Esc fecha só o de cima. */
const pilhaAbertos: symbol[] = [];

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeDisabled = false,
  stacked = false,
  camada,
  semReportar = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: keyof typeof panelSizes;
  closeDisabled?: boolean;
  stacked?: boolean;
  /** Camada do z-index; sem ela, `stacked` decide entre modal e confirm. */
  camada?: keyof typeof Z;
  /** Esconde o botão "Reportar" do cabeçalho (o próprio modal do reporte). */
  semReportar?: boolean;
}) {
  const reportar = useReportarErro();
  const painelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol | null>(null);
  const fecharRef = useRef<() => void>(() => {});

  function tryClose() {
    if (closeDisabled) return;
    onClose();
  }

  useEffect(() => {
    fecharRef.current = tryClose;
  });

  // Registra a ordem de abertura só quando abre/fecha: re-renderizar o modal de
  // baixo não pode passá-lo para cima da pilha.
  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    idRef.current = id;
    pilhaAbertos.push(id);
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || pilhaAbertos[pilhaAbertos.length - 1] !== id) return;
      fecharRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = pilhaAbertos.indexOf(id);
      if (i >= 0) pilhaAbertos.splice(i, 1);
    };
  }, [open]);

  // Trava o scroll do fundo. O conteúdo do app rola no <main data-app-scroll>,
  // então travar só o body deixava a tela de trás acompanhar o scroll do modal.
  useEffect(() => {
    if (!open) return;
    const alvos = [
      document.body,
      ...document.querySelectorAll<HTMLElement>("[data-app-scroll]"),
    ];
    const anteriores = alvos.map((el) => el.style.overflow);
    for (const el of alvos) el.style.overflow = "hidden";
    return () => {
      alvos.forEach((el, i) => {
        el.style.overflow = anteriores[i];
      });
    };
  }, [open]);

  if (!open) return null;

  const z = Z[camada ?? (stacked ? "confirm" : "modal")];

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6"
      style={{ zIndex: z }}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={tryClose}
        aria-hidden
      />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        className={clsx(
          "relative flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl",
          size === "2xl"
            ? "max-h-[min(94vh,980px)]"
            : "max-h-[min(92vh,920px)]",
          panelSizes[size]
        )}
        style={{ zIndex: z + 1 }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-slate-800 sm:text-lg">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {reportar && !semReportar ? (
              <button
                type="button"
                onClick={() => reportar.abrir(painelRef.current)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Reportar no Responsum"
                title="Reportar no Responsum"
              >
                <Bug size={15} />
                <span className="hidden sm:inline">Reportar</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={tryClose}
              disabled={closeDisabled}
              className={clsx(
                "rounded-lg p-1 text-slate-400",
                closeDisabled
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-slate-100 hover:text-slate-600"
              )}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
