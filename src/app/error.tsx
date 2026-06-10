"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SAMA] erro não tratado:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertTriangle size={26} />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-800">
        Algo deu errado
      </h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Ocorreu um erro inesperado. Tente novamente — se persistir, avise o
        Leonardo.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-300">código: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <RefreshCw size={15} /> Tentar novamente
      </button>
    </div>
  );
}
