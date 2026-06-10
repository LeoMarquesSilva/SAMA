"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { clsx } from "clsx";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa do <ToastProvider>.");
  return ctx;
}

const kindStyle: Record<ToastKind, { icon: typeof Info; classes: string }> = {
  success: { icon: CheckCircle2, classes: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  error: { icon: AlertCircle, classes: "border-red-200 bg-red-50 text-red-800" },
  info: { icon: Info, classes: "border-slate-200 bg-white text-slate-700" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      // erro fica mais tempo na tela
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const api: ToastApi = {
    toast,
    success: (m) => toast(m, "success"),
    error: (m) => toast(m, "error"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* acima da bottom-nav no mobile; canto inferior direito no desktop */}
      <div className="pointer-events-none fixed inset-x-3 bottom-20 z-[70] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-5 md:right-5 md:items-end">
        {items.map((t) => {
          const { icon: Icon, classes } = kindStyle[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={clsx(
                "animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg shadow-slate-900/5",
                classes
              )}
            >
              <Icon size={17} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
                aria-label="Fechar aviso"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
