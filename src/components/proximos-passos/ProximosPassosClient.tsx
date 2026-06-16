"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Circle, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReuniaoForm } from "@/components/reunioes/ReuniaoForm";
import { togglePassoReuniao } from "@/app/(app)/proximos-passos/actions";
import type { PassoReuniaoGrupo } from "@/lib/proximos-passos";
import { TIPO_REUNIAO } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { ReuniaoComRelacoes } from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";

type FiltroPasso = "PENDENTE" | "REALIZADA" | "TODOS";

export function ProximosPassosClient({
  grupos,
  totais,
  colaboradores,
  fellowAtivo,
}: {
  grupos: PassoReuniaoGrupo[];
  totais: { pendentes: number; realizados: number };
  colaboradores: ColaboradorOpt[];
  fellowAtivo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<FiltroPasso>("PENDENTE");
  const [editReuniao, setEditReuniao] = useState<ReuniaoComRelacoes | null>(
    null
  );
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return grupos
      .map((grupo) => {
        let itens = grupo.itens;

        if (fStatus === "PENDENTE") itens = itens.filter((i) => !i.done);
        if (fStatus === "REALIZADA") itens = itens.filter((i) => i.done);

        if (q) {
          const hayGrupo = [
            grupo.reuniao.titulo,
            grupo.reuniao.cliente?.nome,
            grupo.reuniao.cliente?.grupo_cliente,
            TIPO_REUNIAO[grupo.reuniao.tipo],
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          itens = itens.filter(
            (i) => i.text.toLowerCase().includes(q) || hayGrupo.includes(q)
          );
        }

        if (itens.length === 0) return null;

        return {
          ...grupo,
          itens,
          pendentes: itens.filter((i) => !i.done).length,
          realizados: itens.filter((i) => i.done).length,
        };
      })
      .filter((g): g is PassoReuniaoGrupo => g !== null);
  }, [grupos, busca, fStatus]);

  const counts = useMemo(
    () => ({
      PENDENTE: totais.pendentes,
      REALIZADA: totais.realizados,
      TODOS: totais.pendentes + totais.realizados,
    }),
    [totais]
  );

  function togglePasso(reuniaoId: string, itemIndex: number, done: boolean) {
    const key = `${reuniaoId}:${itemIndex}`;
    setTogglingKey(key);
    startTransition(async () => {
      await togglePassoReuniao(reuniaoId, itemIndex, done);
      setTogglingKey(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
          Próximos passos
        </h1>
        <p className="text-sm text-slate-500">
          {totais.pendentes} pendente(s) · {totais.realizados} realizado(s) ·{" "}
          {grupos.length} reunião(ões)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "PENDENTE", label: "Pendentes" },
            { key: "REALIZADA", label: "Realizadas" },
            { key: "TODOS", label: "Todos" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFStatus(f.key)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
              fStatus === f.key
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {f.label}
            <span
              className={clsx(
                "rounded-full px-1.5 text-[11px] font-semibold",
                fStatus === f.key
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar reunião ou ação…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
        />
        {busca && (
          <button
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {filtrado.length === 0 ? (
        <EmptyState
          title={
            grupos.length === 0
              ? "Nenhum próximo passo registrado"
              : "Nenhum item corresponde aos filtros"
          }
          description={
            grupos.length === 0
              ? "Ações de reuniões realizadas aparecem aqui após serem registradas no formulário."
              : "Tente outro filtro ou termo de busca."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtrado.map((grupo) => (
            <section
              key={grupo.reuniao.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-800">
                      {grupo.reuniao.titulo}
                    </h2>
                    <Badge tone="green">Reunião</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={13} />
                      {formatDateTime(grupo.reuniao.data_hora_inicio)}
                    </span>
                    <span>{TIPO_REUNIAO[grupo.reuniao.tipo]}</span>
                    {grupo.reuniao.cliente?.nome && (
                      <span>{grupo.reuniao.cliente.nome}</span>
                    )}
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                  <span className="text-xs text-slate-500">
                    {grupo.pendentes} pend. · {grupo.realizados} ok
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => setEditReuniao(grupo.reuniao)}
                  >
                    Ver reunião
                  </Button>
                </div>
              </header>

              <ul className="divide-y divide-slate-100">
                {grupo.itens.map((item) => {
                  const key = `${item.reuniaoId}:${item.itemIndex}`;
                  const busy = pending && togglingKey === key;

                  return (
                    <li key={key}>
                      <label
                        className={clsx(
                          "flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-slate-50",
                          busy && "opacity-60"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={busy}
                          onChange={(e) =>
                            togglePasso(
                              item.reuniaoId,
                              item.itemIndex,
                              e.target.checked
                            )
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={clsx(
                              "text-sm leading-snug text-slate-800",
                              item.done && "text-slate-400 line-through"
                            )}
                          >
                            {item.text}
                          </span>
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                            {item.done ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                Realizada
                              </>
                            ) : (
                              <>
                                <Circle size={12} className="text-amber-500" />
                                Pendente
                              </>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editReuniao && (
        <ReuniaoForm
          open
          onClose={() => setEditReuniao(null)}
          onSaved={() => router.refresh()}
          reuniao={editReuniao}
          colaboradores={colaboradores}
          fellowAtivo={fellowAtivo}
        />
      )}
    </div>
  );
}
