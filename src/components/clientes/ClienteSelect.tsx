"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Building2,
  Loader2,
  ChevronDown,
  UserPlus,
} from "lucide-react";
import { clsx } from "clsx";
import {
  buscarClientes,
  criarLeadCaptacao,
  type ClienteBusca,
} from "@/app/(app)/clientes/actions";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { Badge } from "@/components/ui/Badge";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

type Selected = { ci: string; nome: string; isCaptacao?: boolean };

function isContatoCaptacao(ci: string) {
  return ci.startsWith("SAMA-LEAD-");
}

/**
 * Seletor de cliente com busca server-side (a base tem ~37k clientes do VIOS).
 * Compatível com FormData via input hidden (name = cliente_id, valor = ci).
 */
export function ClienteSelect({
  name = "cliente_id",
  label = "Cliente",
  tooltip,
  required = false,
  allowCreateLead = false,
  defaultValue = "",
  defaultLabel = "",
  error,
}: {
  name?: string;
  label?: string;
  tooltip?: string;
  required?: boolean;
  /** Em Captação: permite criar lead se o nome não existir na base. */
  allowCreateLead?: boolean;
  defaultValue?: string;
  defaultLabel?: string;
  error?: string;
}) {
  const [selected, setSelected] = useState<Selected | null>(
    defaultValue
      ? {
          ci: defaultValue,
          nome: defaultLabel || defaultValue,
          isCaptacao: isContatoCaptacao(defaultValue),
        }
      : null
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClienteBusca[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  const panelStyle = useFloatingPanel(open, rootRef, false);

  const trimmedQ = q.trim();
  const podeCriarLead =
    allowCreateLead &&
    trimmedQ.length >= 2 &&
    !loading &&
    !creating &&
    !results.some((r) => r.nome.toLowerCase() === trimmedQ.toLowerCase());

  const panelItems = [
    ...(podeCriarLead ? [{ kind: "create" as const }] : []),
    ...results.map((c) => ({ kind: "result" as const, c })),
  ];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.clearTimeout(debounceRef.current);
    if (trimmedQ.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setCreateError(undefined);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const r = await buscarClientes(trimmedQ);
        setResults(r);
        setActive(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [q, open, trimmedQ]);

  function abrir() {
    setQ("");
    setResults([]);
    setCreateError(undefined);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function pick(c: ClienteBusca, isCaptacao = false) {
    setSelected({
      ci: c.ci,
      nome: c.nome,
      isCaptacao: isCaptacao || isContatoCaptacao(c.ci),
    });
    setOpen(false);
    setCreateError(undefined);
  }

  async function criarLead() {
    if (!podeCriarLead) return;
    setCreating(true);
    setCreateError(undefined);
    const r = await criarLeadCaptacao(trimmedQ);
    setCreating(false);
    if (!r.ok || !r.cliente) {
      setCreateError(r.error ?? "Erro ao criar lead.");
      return;
    }
    pick(r.cliente, true);
  }

  function limpar() {
    setSelected(null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, panelItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = panelItems[active];
      if (!item) return;
      if (item.kind === "create") void criarLead();
      else pick(item.c);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-1" onKeyDown={onKeyDown}>
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <input type="hidden" name={name} value={selected?.ci ?? ""} />

      <div className="relative">
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
                {selected.isCaptacao && (
                  <Badge tone="blue">Captação</Badge>
                )}
              </span>
            ) : (
              <span className="text-slate-400">Buscar cliente...</span>
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

        {open && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-500 bg-white px-3 ring-1 ring-brand-500">
            {loading || creating ? (
              <Loader2 size={15} className="animate-spin text-slate-400" />
            ) : (
              <Search size={15} className="text-slate-400" />
            )}
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                allowCreateLead
                  ? "Buscar cliente ou digitar nome do contato..."
                  : "Buscar por nome, CNPJ ou grupo..."
              }
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

        {mounted &&
          open &&
          createPortal(
            <div
              ref={panelRef}
              style={panelStyle}
              className="animate-dialog-in overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
            >
              {trimmedQ.length < 2 ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">
                  Digite ao menos 2 letras para buscar nos{" "}
                  <strong>clientes do VIOS</strong>.
                  {allowCreateLead && (
                    <>
                      {" "}
                      Se não existir, você poderá criar um contato de{" "}
                      <strong>Captação</strong>.
                    </>
                  )}
                </p>
              ) : (
                <>
                  {podeCriarLead && (
                    <button
                      type="button"
                      data-idx={0}
                      onClick={() => void criarLead()}
                      onMouseEnter={() => setActive(0)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm",
                        active === 0 && "bg-brand-50"
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                        <UserPlus size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone="blue">+ Captação</Badge>
                          <span className="font-medium text-slate-800">
                            Criar &ldquo;{trimmedQ.toLocaleUpperCase("pt-BR")}&rdquo;
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Contato ainda não cadastrado na base
                        </span>
                      </span>
                    </button>
                  )}

                  {results.length === 0 && !podeCriarLead && !loading && (
                    <p className="px-3 py-3 text-center text-xs text-slate-400">
                      Nenhum cliente encontrado para &ldquo;{trimmedQ}&rdquo;.
                    </p>
                  )}

                  {results.map((c, i) => {
                    const idx = podeCriarLead ? i + 1 : i;
                    const isCaptacao = isContatoCaptacao(c.ci);
                    return (
                      <button
                        key={c.ci}
                        type="button"
                        data-idx={idx}
                        onClick={() => pick(c)}
                        onMouseEnter={() => setActive(idx)}
                        className={clsx(
                          "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left",
                          idx === active && "bg-slate-100"
                        )}
                      >
                        <Building2
                          size={15}
                          className="mt-0.5 shrink-0 text-slate-400"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block truncate text-sm text-slate-800">
                              {c.nome}
                            </span>
                            {isCaptacao && <Badge tone="blue">Captação</Badge>}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {[c.cpf_cnpj, c.grupo_cliente]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}

              {createError && (
                <p className="px-3 py-2 text-xs text-red-600">{createError}</p>
              )}
            </div>,
            document.body
          )}
      </div>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
