"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { listarEmpresasDoGrupo } from "@/app/(app)/clientes/actions";
import type { EmpresaDoGrupo } from "@/types/database";

const POR_PAGINA = 40;

export function GrupoEmpresasModal({
  open,
  onClose,
  grupoCliente,
  grupoLabel,
}: {
  open: boolean;
  onClose: () => void;
  grupoCliente: string;
  grupoLabel: string;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [empresas, setEmpresas] = useState<EmpresaDoGrupo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const carregar = useCallback(async () => {
    if (!open) return;
    setCarregando(true);
    try {
      const res = await listarEmpresasDoGrupo(grupoCliente, {
        q: busca,
        pagina,
        porPagina: POR_PAGINA,
      });
      setEmpresas(res.empresas);
      setTotal(res.total);
    } finally {
      setCarregando(false);
    }
  }, [open, grupoCliente, busca, pagina]);

  useEffect(() => {
    if (!open) return;
    setPagina(1);
    setBusca("");
  }, [open, grupoCliente]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void carregar();
    }, busca ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [open, carregar, busca]);

  useEffect(() => {
    if (open) setPagina(1);
  }, [busca, open]);

  return (
    <Modal open={open} onClose={onClose} title={grupoLabel} size="lg">
      <p className="mb-4 text-sm text-slate-500">
        {total.toLocaleString("pt-BR")}{" "}
        {total === 1 ? "empresa neste grupo" : "empresas neste grupo"}
      </p>

      <div className="relative mb-4">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar empresas por nome ou CNPJ..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {carregando ? (
        <p className="py-8 text-center text-sm text-slate-400">Carregando...</p>
      ) : empresas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Nenhuma empresa encontrada.
        </p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {empresas.map((e) => (
            <li key={e.ci}>
              <Link
                href={`/clientes/${encodeURIComponent(e.ci)}`}
                onClick={onClose}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{e.nome}</p>
                  <p className="text-xs text-slate-500">
                    {[e.cpf_cnpj, e.qtd_processos > 0 && `${e.qtd_processos} processos`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {e.categoria && (
                    <span className="mt-1 inline-block">
                      <Badge tone="gray">{e.categoria}</Badge>
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || carregando}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || carregando}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
