"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { useFloatingPanel } from "@/hooks/useFloatingPanel";
import { Z } from "@/lib/zIndex";

export type SelectOption = {
  value: string;
  label: string;
  description?: string | null;
  avatar?: { nome: string; src?: string | null };
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setMobile(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

/**
 * Dropdown padrão do sistema (substitui <select> nativo).
 * - Desktop: painel ancorado, com flip para cima perto da borda inferior
 * - Mobile: bottom sheet com alvo de toque generoso
 * - Busca automática em listas longas, navegação por teclado, FormData via input hidden
 */
export function SelectMenu({
  options,
  value,
  defaultValue = "",
  onChange,
  name,
  label,
  placeholder = "— Selecionar —",
  emptyOption,
  searchable,
  error,
  className,
  disabled,
  id,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  label?: string;
  placeholder?: string;
  /** Rótulo da opção "nenhum/todos" (permite limpar a seleção). */
  emptyOption?: string;
  /** Força busca; por padrão ativa quando há mais de 8 opções. */
  searchable?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? (label ? autoId : undefined);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelStyle = useFloatingPanel(open && !isMobile, btnRef, dropUp);

  useEffect(() => setMounted(true), []);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedValue = value !== undefined ? value : internal;
  const selected = options.find((o) => o.value === selectedValue) ?? null;
  const canSearch = searchable ?? options.length > 8;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;
  const items: SelectOption[] = [
    ...(emptyOption && !q ? [{ value: "", label: emptyOption }] : []),
    ...filtered,
  ];

  // Fecha ao clicar fora (desktop).
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Trava o scroll do body quando o sheet mobile está aberto.
  useEffect(() => {
    if (open && isMobile) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, isMobile]);

  function abrir() {
    if (disabled) return;
    // Decide direção no desktop: flip se faltar espaço abaixo.
    if (!isMobile && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 300 && rect.top > 300);
    }
    setQuery("");
    const idx = items.findIndex((o) => o.value === selectedValue);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }

  function pick(v: string) {
    if (value === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) pick(items[active].value);
    }
  }

  // Mantém o item ativo visível ao navegar por teclado.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const Lista = (
    <div ref={listRef} className="overflow-y-auto p-1" role="listbox">
      {items.length === 0 && (
        <p className="px-3 py-4 text-center text-sm text-slate-400">
          Nada encontrado.
        </p>
      )}
      {items.map((o, i) => {
        const sel = o.value === selectedValue;
        return (
          <button
            key={`${o.value}-${i}`}
            type="button"
            role="option"
            aria-selected={sel}
            data-idx={i}
            title={o.description ?? undefined}
            onClick={() => pick(o.value)}
            onMouseEnter={() => setActive(i)}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm",
              isMobile ? "py-3" : "py-2",
              i === active && "bg-slate-100",
              sel ? "font-medium text-brand-700" : "text-slate-700",
              !o.value && "text-slate-500"
            )}
          >
            {o.avatar && (
              <Avatar nome={o.avatar.nome} src={o.avatar.src} size={26} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.description && (
                <span className="block line-clamp-3 text-xs font-normal leading-snug text-slate-400">
                  {o.description}
                </span>
              )}
            </span>
            {sel && <Check size={15} className="shrink-0 text-brand-600" />}
          </button>
        );
      })}
    </div>
  );

  const Busca = canSearch && (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3">
      <Search size={15} className="shrink-0 text-slate-400" />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        placeholder="Buscar..."
        className="w-full bg-transparent py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
      />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={clsx("flex flex-col gap-1", className)}
      onKeyDown={onKeyDown}
    >
      {label && buttonId && (
        <label htmlFor={buttonId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {label && !buttonId && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      {name && <input type="hidden" name={name} value={selectedValue} />}

      <div className="relative">
        <button
          ref={btnRef}
          id={buttonId}
          type="button"
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : abrir())}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={clsx(
            "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1",
            disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-slate-300 focus:border-brand-500 focus:ring-brand-500"
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2 text-slate-800">
              {selected.avatar && (
                <Avatar
                  nome={selected.avatar.nome}
                  src={selected.avatar.src}
                  size={22}
                />
              )}
              <span className="truncate">{selected.label}</span>
            </span>
          ) : (
            <span className="truncate text-slate-400">
              {emptyOption && selectedValue === "" ? emptyOption : placeholder}
            </span>
          )}
          <ChevronDown
            size={16}
            className={clsx(
              "shrink-0 text-slate-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

      </div>

      {/* Desktop: painel em portal (evita corte pelo overflow do modal) */}
      {mounted &&
        open &&
        !isMobile &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="animate-dialog-in flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {Busca}
            <div className="min-h-0 flex-1 overflow-y-auto">{Lista}</div>
          </div>,
          document.body
        )}

      {/* Mobile: bottom sheet */}
      {open && isMobile && (
        <div className="fixed inset-0" style={{ zIndex: Z.popover }}>
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="animate-dialog-in absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">
                {label ?? placeholder}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            {Busca}
            <div className="min-h-0 flex-1 overflow-y-auto">{Lista}</div>
          </div>
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
