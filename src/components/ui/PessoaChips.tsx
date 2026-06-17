"use client";

import { clsx } from "clsx";
import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export type PessoaChipOpt = {
  id: string;
  nome: string;
  avatar_url?: string | null;
};

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Filtro de pessoas em chips com avatar (usado no dashboard e no calendário). */
export function PessoaChips({
  pessoas,
  value,
  onChange,
  label = "Pessoa",
}: {
  pessoas: PessoaChipOpt[];
  value: string;
  onChange: (id: string) => void;
  label?: string | null;
}) {
  return (
    <div className="w-full min-w-0">
      {label && (
        <p className="mb-2 text-center text-xs font-medium text-slate-500">
          {label}
        </p>
      )}
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
