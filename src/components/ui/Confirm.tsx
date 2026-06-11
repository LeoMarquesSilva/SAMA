"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Z } from "@/lib/zIndex";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" = vermelho (excluir); "warning" = âmbar (cancelar/desativar) */
  tone?: "danger" | "warning";
  /** Quando presente, mostra um textarea e resolve com o texto digitado. */
  input?: { label: string; placeholder?: string; required?: boolean };
};

// Sem input: resolve true/false. Com input: resolve string (texto) ou null (cancelou).
type Resolver = (value: boolean | string | null) => void;

type ConfirmApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  confirmWithInput: (opts: ConfirmOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmApi | null>(null);

export function useConfirm(): ConfirmApi {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa do <ConfirmProvider>.");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [text, setText] = useState("");
  const resolver = useRef<Resolver | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((value: boolean | string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
    setText("");
  }, []);

  const open = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setText("");
    return new Promise<boolean | string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  useEffect(() => {
    if (!opts) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(opts!.input ? null : false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opts, close]);

  const api: ConfirmApi = {
    confirm: (o) => open(o) as Promise<boolean>,
    confirmWithInput: (o) =>
      open({ ...o, input: o.input ?? { label: "Motivo" } }) as Promise<
        string | null
      >,
  };

  const tone = opts?.tone ?? "danger";
  const Icon = tone === "danger" ? AlertTriangle : HelpCircle;
  const podeConfirmar = !opts?.input?.required || text.trim().length > 0;

  function handleConfirm() {
    if (!opts) return;
    close(opts.input ? text.trim() : true);
  }

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
          style={{ zIndex: Z.confirm }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => close(opts.input ? null : false)}
            aria-hidden
          />
          <div className="animate-dialog-in relative z-10 w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  tone === "danger"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                )}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id="confirm-title"
                  className="text-base font-semibold text-slate-800"
                >
                  {opts.title}
                </h2>
                {opts.message && (
                  <p className="mt-1 text-sm text-slate-500">{opts.message}</p>
                )}
              </div>
            </div>

            {opts.input && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  {opts.input.label}
                  {opts.input.required && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <textarea
                  autoFocus
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={opts.input.placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => close(opts.input ? null : false)}
              >
                {opts.cancelLabel ?? "Voltar"}
              </Button>
              <button
                ref={confirmBtnRef}
                onClick={handleConfirm}
                disabled={!podeConfirmar}
                className={clsx(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                  tone === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-500 hover:bg-amber-600"
                )}
              >
                {opts.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
