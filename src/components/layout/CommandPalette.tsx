"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CalendarClock,
  ClipboardList,
  Building2,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { globalSearch, type SearchResult } from "@/app/(app)/search/actions";

const tipoLabel: Record<SearchResult["tipo"], string> = {
  reuniao: "Reunião",
  cliente: "Cliente",
  pessoa: "Pessoa",
  atividade: "Atividade",
};

function TipoIcon({ tipo }: { tipo: SearchResult["tipo"] }) {
  if (tipo === "reuniao") return <CalendarClock size={16} />;
  if (tipo === "atividade") return <ClipboardList size={16} />;
  if (tipo === "cliente") return <Building2 size={16} />;
  return null;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounceRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      // foca após o render do modal
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Busca com debounce
  useEffect(() => {
    if (!open) return;
    window.clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await globalSearch(q);
        setResults(r);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [q, open]);

  const go = useCallback(
    (r: SearchResult) => {
      setOpen(false);
      router.push(r.href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <>
      {/* Gatilho no header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search size={15} />
        <span className="hidden md:inline">Buscar...</span>
        <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400 md:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="animate-dialog-in relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              {loading ? (
                <Loader2 size={17} className="animate-spin text-slate-400" />
              ) : (
                <Search size={17} className="text-slate-400" />
              )}
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Buscar reuniões, clientes, pessoas, atividades..."
                className="w-full bg-transparent py-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">
                esc
              </kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  Digite pelo menos 2 letras para buscar.
                </p>
              ) : results.length === 0 && !loading ? (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  Nada encontrado para “{q}”.
                </p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={`${r.tipo}-${r.id}`}
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                      i === active ? "bg-brand-50" : "hover:bg-slate-50"
                    )}
                  >
                    {r.tipo === "pessoa" ? (
                      <Avatar nome={r.titulo} src={r.avatar_url} size={28} />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <TipoIcon tipo={r.tipo} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {r.titulo}
                      </span>
                      {r.subtitulo && (
                        <span className="block truncate text-xs text-slate-400">
                          {r.subtitulo}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {tipoLabel[r.tipo]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
