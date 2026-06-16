"use client";

import { useRouter, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Users } from "lucide-react";
import { tipoReuniaoOptions } from "@/lib/constants";
import { todayKeyInTz } from "@/lib/timezone";
import { Avatar } from "@/components/ui/Avatar";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Input } from "@/components/ui/Input";

const PERIODOS = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "ano", label: "Este ano" },
];

type PessoaOpt = { id: string; nome: string; avatar_url?: string | null };

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

function DashboardPessoaChips({
  pessoas,
  value,
  onChange,
}: {
  pessoas: PessoaOpt[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="w-full min-w-0">
      <p className="mb-2 text-center text-xs font-medium text-slate-500">Pessoa</p>
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-fit min-w-full justify-center gap-2 px-1">
        <button
          type="button"
          onClick={() => onChange("")}
          className={clsx(
            "inline-flex shrink-0 flex-col items-center gap-1 rounded-xl border px-2.5 py-2 transition",
            !value
              ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          )}
          title="Todas as pessoas"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Users size={18} />
          </span>
          <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-slate-700">
            Todos
          </span>
        </button>

        {pessoas.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(active ? "" : p.id)}
              className={clsx(
                "inline-flex shrink-0 flex-col items-center gap-1 rounded-xl border px-2.5 py-2 transition",
                active
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
              title={p.nome}
            >
              <Avatar nome={p.nome} src={p.avatar_url} size={40} />
              <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-slate-700">
                {primeiroNome(p.nome)}
              </span>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

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
        <DashboardPessoaChips
          pessoas={pessoas}
          value={pessoa}
          onChange={(id) => update({ pessoa: id })}
        />
      )}
    </div>
  );
}
