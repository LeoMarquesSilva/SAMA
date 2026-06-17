"use client";

import { useRouter, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { tipoReuniaoOptions } from "@/lib/constants";
import { todayKeyInTz } from "@/lib/timezone";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Input } from "@/components/ui/Input";
import { PessoaChips, type PessoaChipOpt } from "@/components/ui/PessoaChips";

const PERIODOS = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "ano", label: "Este ano" },
];

type PessoaOpt = PessoaChipOpt;

export function DashboardFiltros({
  periodo,
  dataDia,
  pessoa,
  tipo,
  pessoas,
  isAdmin,
}: {
  periodo: string;
  dataDia: string;
  pessoa: string;
  tipo: string;
  pessoas: PessoaOpt[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams();
    const nextP = patch.p ?? periodo;
    const nextData = patch.data ?? dataDia;
    const nextPessoa = patch.pessoa ?? pessoa;
    const nextTipo = patch.tipo ?? tipo;

    if (nextP === "dia") {
      params.set("p", "dia");
      params.set("data", nextData || todayKeyInTz());
    } else if (nextP) {
      params.set("p", nextP);
    }
    if (nextPessoa) params.set("pessoa", nextPessoa);
    if (nextTipo) params.set("tipo", nextTipo);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() =>
                update({
                  p: p.key,
                  ...(p.key === "dia" ? { data: dataDia || todayKeyInTz() } : {}),
                })
              }
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

        {periodo === "dia" && (
          <Input
            type="date"
            value={dataDia || todayKeyInTz()}
            onChange={(e) => update({ p: "dia", data: e.target.value })}
            className="w-full py-1.5 sm:w-40"
          />
        )}

        <SelectMenu
          value={tipo}
          onChange={(v) => update({ tipo: v })}
          emptyOption="Todos os tipos"
          placeholder="Todos os tipos"
          options={tipoReuniaoOptions(false)}
          className="w-full sm:w-52"
        />
      </div>

      {isAdmin && (
        <PessoaChips
          pessoas={pessoas}
          value={pessoa}
          onChange={(id) => update({ pessoa: id })}
        />
      )}
    </div>
  );
}
