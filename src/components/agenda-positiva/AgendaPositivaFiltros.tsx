"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { iniciarNavegacao } from "@/components/layout/Navegacao";
import {
  CLUSTERS_AGENDA,
  labelMesLongo,
  mesAtualKey,
  somarMeses,
} from "@/lib/agenda-positiva";
import type { TipoReuniaoItem } from "@/lib/reuniao-tipos";

export function AgendaPositivaFiltros({
  mes,
  cluster,
  tipo,
  tiposReuniao,
}: {
  mes: string;
  cluster: string;
  tipo: string;
  tiposReuniao: TipoReuniaoItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const mesAtual = mesAtualKey();

  function update(patch: { mes?: string; cluster?: string; tipo?: string }) {
    const params = new URLSearchParams();
    const nextMes = patch.mes ?? mes;
    const nextCluster = patch.cluster ?? cluster;
    const nextTipo = patch.tipo ?? tipo;
    if (nextMes !== mesAtual) params.set("mes", nextMes);
    if (nextCluster) params.set("cluster", nextCluster);
    if (nextTipo) params.set("tipo", nextTipo);
    const url = params.size ? `${pathname}?${params.toString()}` : pathname;
    iniciarNavegacao(url);
    startTransition(() => router.push(url));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => update({ mes: somarMeses(mes, -1) })}
          className="rounded-full p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[9.5rem] text-center text-sm font-medium capitalize text-slate-700">
          {labelMesLongo(mes)}
        </span>
        <button
          type="button"
          onClick={() => update({ mes: somarMeses(mes, 1) })}
          disabled={mes >= mesAtual}
          className="rounded-full p-1 text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {mes !== mesAtual && (
        <button
          type="button"
          onClick={() => update({ mes: mesAtual })}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          Voltar ao mês atual
        </button>
      )}

      <div className="flex gap-1 rounded-full bg-slate-100 p-1">
        {[{ chave: "", curto: "Todos os clusters" }, ...CLUSTERS_AGENDA].map((c) => (
          <button
            key={c.chave || "todos"}
            type="button"
            onClick={() => update({ cluster: c.chave })}
            className={clsx(
              "rounded-full px-3 py-1 text-sm font-medium transition",
              cluster === c.chave ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            )}
          >
            {c.curto}
          </button>
        ))}
      </div>

      <SelectMenu
        value={tipo}
        onChange={(v) => update({ tipo: v })}
        emptyOption="Todos os tipos"
        placeholder="Todos os tipos"
        options={tiposReuniao.map((t) => ({ value: t.chave, label: t.label }))}
        className="w-full sm:w-56"
      />
    </div>
  );
}
