import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("animate-pulse rounded-lg bg-slate-200/70", className)} />
  );
}

/** Cabeçalho de página (título + subtítulo + botão de ação). */
export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  );
}

/** Lista de cards genérica (páginas de listagem). */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/5" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid de cards numéricos (totalizadores). */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Página de listagem padrão: header + filtros + cards. */
export function ListPageSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <CardListSkeleton />
    </div>
  );
}
