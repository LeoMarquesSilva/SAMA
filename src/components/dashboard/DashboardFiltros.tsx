"use client";

import { useRouter, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { tipoReuniaoOptions } from "@/lib/constants";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { SelectMenu } from "@/components/ui/SelectMenu";

const PERIODOS = [
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "ano", label: "Este ano" },
];

export function DashboardFiltros({
  periodo,
  pessoa,
  tipo,
  pessoas,
  isAdmin,
}: {
  periodo: string;
  pessoa: string;
  tipo: string;
  pessoas: { id: string; nome: string; avatar_url?: string | null }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams();
    const next = { p: periodo, pessoa, tipo, ...patch };
    if (next.p) params.set("p", next.p);
    if (next.pessoa) params.set("pessoa", next.pessoa);
    if (next.tipo) params.set("tipo", next.tipo);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-full bg-slate-100 p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            onClick={() => update({ p: p.key })}
            className={clsx(
              "rounded-full px-3 py-1 text-sm font-medium transition",
              periodo === p.key
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-500"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <SelectMenu
        value={tipo}
        onChange={(v) => update({ tipo: v })}
        emptyOption="Todos os tipos"
        placeholder="Todos os tipos"
        options={tipoReuniaoOptions(false)}
        className="w-full sm:w-52"
      />

      {isAdmin && (
        <PersonSelect
          pessoas={pessoas}
          value={pessoa}
          onChange={(id) => update({ pessoa: id })}
          placeholder="Todas as pessoas"
          emptyLabel="Todas as pessoas"
          className="min-w-[200px]"
        />
      )}
    </div>
  );
}
