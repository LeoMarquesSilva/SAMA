"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ListPageSkeleton } from "@/components/ui/Skeleton";

/** Se a URL não mudar (ex.: navegação cancelada), some sozinho depois disso. */
const LIMITE_MS = 15_000;

type Destino = {
  /** pathname + search de destino. */
  url: string;
  /** false: só a barra do topo, sem mexer no conteúdo (ex.: busca enquanto digita). */
  esmaecer: boolean;
};

/** Navegação em andamento, ou null. */
let destino: Destino | null = null;
let limite: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function definirDestino(valor: Destino | null) {
  if (limite) clearTimeout(limite);
  limite = valor ? setTimeout(() => definirDestino(null), LIMITE_MS) : null;
  destino = valor;
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function useDestino() {
  return useSyncExternalStore(
    assinar,
    () => destino,
    () => null
  );
}

/**
 * Avisa que uma navegação começou — chamar antes de `router.push`/`replace`.
 * Cliques em links (<Link>/<a>) já são detectados sozinhos.
 */
export function iniciarNavegacao(href: string, { esmaecer = true } = {}) {
  if (typeof window === "undefined") return;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return;
  const alvo = url.pathname + url.search;
  if (alvo === window.location.pathname + window.location.search) return;
  definirDestino({ url: alvo, esmaecer });
}

/** Barra no topo + detecção de cliques em links e do fim da navegação. */
export function NavegacaoProgresso() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const ativo = useDestino() !== null;

  // A URL mudou: a navegação terminou (ou mostrou o skeleton da rota).
  useEffect(() => {
    definirDestino(null);
  }, [pathname, search]);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      iniciarNavegacao(link.href);
    }
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  if (!ativo) return null;
  return (
    <div
      role="progressbar"
      aria-label="Carregando"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-brand-100"
    >
      <div className="animate-nav-progress h-full w-2/5 rounded-full bg-brand-500" />
    </div>
  );
}

/**
 * Conteúdo da página durante a navegação: indo para outra página, mostra o skeleton
 * na hora; na mesma página (filtros, busca, período), esmaece e pulsa o conteúdo atual.
 */
export function ConteudoNavegacao({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const alvo = useDestino();

  if (alvo?.esmaecer && alvo.url.split("?")[0] !== pathname) {
    return <ListPageSkeleton />;
  }
  return (
    <div
      aria-busy={alvo !== null}
      className={clsx(
        "transition-opacity duration-200",
        alvo?.esmaecer && "pointer-events-none animate-pulse opacity-60"
      )}
    >
      {children}
    </div>
  );
}
