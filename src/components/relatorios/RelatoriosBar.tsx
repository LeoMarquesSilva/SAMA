"use client";

import { useRouter, usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { TIPO_REUNIAO } from "@/lib/constants";

const PERIODOS = [
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "ano", label: "Este ano" },
];

export function RelatoriosBar({
  periodo,
  tipo,
  de,
  ate,
}: {
  periodo: string;
  tipo: string;
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(patch: Record<string, string>) {
    const next = { p: periodo, tipo, ...patch };
    const params = new URLSearchParams();
    if (next.p) params.set("p", next.p);
    if (next.tipo) params.set("tipo", next.tipo);
    router.push(`${pathname}?${params.toString()}`);
  }

  const qs = new URLSearchParams({ de, ate });
  if (tipo) qs.set("tipo", tipo);
  const reunioesHref = `/api/export/reunioes?${qs.toString()}`;
  const timesheetHref = `/api/export/timesheet?de=${de}&ate=${ate}`;

  return (
    <div className="space-y-3 print:hidden">
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
          options={Object.entries(TIPO_REUNIAO).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
          className="w-full sm:w-44"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={reunioesHref} download>
          <Button variant="secondary" size="sm">
            <Download size={15} /> Reuniões (CSV)
          </Button>
        </a>
        <a href={timesheetHref} download>
          <Button variant="secondary" size="sm">
            <Download size={15} /> Timesheet (CSV)
          </Button>
        </a>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir / PDF
        </Button>
      </div>
    </div>
  );
}
