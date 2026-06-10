"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Building2, Loader2, ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { buscarClientes, type ClienteBusca } from "@/app/(app)/clientes/actions";

/**
 * Seletor de cliente com busca server-side (a base tem ~37k clientes do VIOS).
 * Compatível com FormData via input hidden (name = cliente_id, valor = ci).
 */
export function ClienteSelect({
  name = "cliente_id",
  label = "Cliente (opcional)",
  defaultValue = "",
  defaultLabel = "",
  error,
}: {
  name?: string;
  label?: string;
  /** ci do cliente já vinculado (edição) */
  defaultValue?: string;
  /** nome do cliente já vinculado (edição) */
  defaultLabel?: string;
  error?: string;
}) {
  const [selected, setSelected] = useState<{ ci: string; nome: string } | null>(
    defaultValue ? { ci: defaultValue, nome: defaultLabel || defaultValue } : null
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClienteBusca[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>(0);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Busca com debounce.
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
        const r = await buscarClientes(q);
        setResults(r);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [q, open]);

  function abrir() {
    setQ("");
    setResults([]);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function pick(c: ClienteBusca) {
    setSelected({ ci: c.ci, nome: c.nome });
    setOpen(false);
  }

  function limpar() {
    setSelected(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) pick(results[active]);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1" onKeyDown={onKeyDown}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="hidden" name={name} value={selected?.ci ?? ""} />

      <div className="relative">
        {/* Campo fechado: mostra a seleção */}
        {!open && (
          <button
            type="button"
            onClick={abrir}
            className={clsx(
              "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1",
              error
                ? "border-red-400 focus:ring-red-500"
                : "border-slate-300 focus:border-brand-500 focus:ring-brand-500"
            )}
          >
            {selected ? (
              <span className="flex min-w-0 items-center gap-2 text-slate-800">
                <Building2 size={15} className="shrink-0 text-slate-400" />
                <span className="truncate">{selected.nome}</span>
              </span>
            ) : (
              <span className="text-slate-400">— Sem cliente —</span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {selected && (
                <X
                  size={15}
                  className="text-slate-400 hover:text-slate-600"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    limpar();
                  }}
                  aria-label="Remover cliente"
                />
              )}
              <ChevronDown size={16} className="text-slate-400" />
            </span>
          </button>
        )}

        {/* Campo aberto: busca */}
        {open && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-500 bg-white px-3 ring-1 ring-brand-500">
            {loading ? (
              <Loader2 size={15} className="animate-spin text-slate-400" />
            ) : (
              <Search size={15} className="text-slate-400" />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou grupo..."
              className="w-full bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fechar busca"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {open && (
          <div className="animate-dialog-in absolute z-[75] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {q.trim().length < 2 ? (
              <p className="px-3 py-3 text-center text-xs text-slate-400">
                Digite ao menos 2 letras para buscar nos{" "}
                <strong>clientes do VIOS</strong>.
              </p>
            ) : results.length === 0 && !loading ? (
              <p className="px-3 py-3 text-center text-xs text-slate-400">
                Nenhum cliente encontrado para “{q}”.
              </p>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.ci}
                  type="button"
                  onClick={() => pick(c)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx(
                    "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left",
                    i === active && "bg-slate-100"
                  )}
                >
                  <Building2 size={15} className="mt-0.5 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-800">
                      {c.nome}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {[c.cpf_cnpj, c.grupo_cliente].filter(Boolean).join(" · ") ||
                        "—"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
