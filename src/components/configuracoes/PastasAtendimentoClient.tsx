"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { salvarPastasAtendimento } from "@/app/(app)/configuracoes/actions";
import type { PastaAtendimentoArea } from "@/lib/reuniao-pastas";

export function PastasAtendimentoClient({
  areas,
  podeEditar,
}: {
  areas: PastaAtendimentoArea[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const { success, error: erroToast } = useToast();
  const [pending, start] = useTransition();
  const [pastas, setPastas] = useState<Record<string, string>>(() =>
    Object.fromEntries(areas.map((a) => [a.area, a.pasta]))
  );
  const [areaAberta, setAreaAberta] = useState<string | null>(null);
  const aberta = areas.find((a) => a.area === areaAberta) ?? null;

  const comPasta = areas.filter((a) => (pastas[a.area] ?? "").replace(/\D/g, "")).length;

  function salvar() {
    start(async () => {
      const r = await salvarPastasAtendimento(
        areas.map((a) => ({ area: a.area, pasta: pastas[a.area] ?? "" }))
      );
      if (!r.ok) {
        erroToast(r.error ?? "Não foi possível salvar.");
        return;
      }
      success("Pastas de atendimento salvas.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FolderOpen size={16} className="text-brand-600" />
            Pastas de atendimento por área
          </h2>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
            Ao agendar uma reunião nova, cada participante interno da área recebe
            um compromisso no VIOS nesta pasta. Quem agenda também recebe: na
            pasta da própria área ou, se ela estiver em branco, na pasta de quem
            participa. {comPasta} de {areas.length} áreas com pasta. Área em branco
            não recebe o compromisso, salvo quem está agendando.
          </p>
        </div>
        {podeEditar && (
          <Button type="button" size="sm" onClick={salvar} disabled={pending}>
            Salvar
          </Button>
        )}
      </div>

      {!podeEditar && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Só administradores podem alterar estas pastas.
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {areas.map((a) => (
          <li
            key={a.area}
            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{a.area}</p>
              <button
                type="button"
                onClick={() => setAreaAberta(a.area)}
                className="text-xs text-brand-700 hover:underline"
              >
                {a.pessoas === 1 ? "1 pessoa" : `${a.pessoas} pessoas`}
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Pasta
              <input
                inputMode="numeric"
                value={pastas[a.area] ?? ""}
                disabled={!podeEditar || pending}
                placeholder="CI do atendimento"
                onChange={(e) =>
                  setPastas((atual) => ({
                    ...atual,
                    [a.area]: e.target.value.replace(/\D/g, "").slice(0, 12),
                  }))
                }
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
              />
            </label>
          </li>
        ))}
      </ul>

      <Modal
        open={aberta !== null}
        onClose={() => setAreaAberta(null)}
        title={aberta?.area ?? "Área"}
      >
        {aberta && aberta.nomes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma pessoa nesta área.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {aberta?.nomes.map((nome) => (
              <li key={nome} className="py-2 text-sm text-slate-800">
                {nome}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
