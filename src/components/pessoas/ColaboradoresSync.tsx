"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, RefreshCw, Search, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";
import { atualizarColaboradores, darAcessoColaborador } from "@/app/(app)/pessoas/actions";

export type ColaboradorSemAcesso = {
  id: string;
  nome: string;
  email: string;
  departamento: string | null;
  cargo: string | null;
  avatar_url: string | null;
};

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ColaboradoresSemAcessoPanel({ colaboradores }: { colaboradores: ColaboradorSemAcesso[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(true);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  if (colaboradores.length === 0) return null;

  const termo = semAcento(busca.trim());
  const visiveis = termo
    ? colaboradores.filter((c) =>
        semAcento(`${c.nome} ${c.email} ${c.departamento ?? ""} ${c.cargo ?? ""}`).includes(termo)
      )
    : colaboradores;

  function darAcesso(c: ColaboradorSemAcesso) {
    setEnviando(c.id);
    startTransition(async () => {
      const r = await darAcessoColaborador(c.id);
      setEnviando(null);
      if (!r.ok) {
        toastError(r.error ?? "Não foi possível dar acesso.");
        return;
      }
      success(`${c.nome} agora tem acesso (senha inicial 123456).`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <UserPlus size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            {colaboradores.length} colaborador(es) do ORQESTRAI sem acesso ao SAMA
          </p>
          <p className="text-xs text-slate-500">
            Dê acesso para criar o login com os módulos padrão; depois ajuste os módulos na lista acima.
          </p>
        </div>
        <ChevronDown
          size={16}
          className={clsx("shrink-0 text-slate-400 transition-transform", aberto && "rotate-180")}
        />
      </button>

      {aberto && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-brand-400">
              <Search size={15} className="text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou área"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {visiveis.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar nome={c.nome} src={c.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[c.cargo, c.departamento].filter(Boolean).join(" · ") || c.email}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={enviando !== null}
                  onClick={() => darAcesso(c)}
                >
                  <UserPlus size={14} />
                  {enviando === c.id ? "Liberando..." : "Dar acesso"}
                </Button>
              </li>
            ))}
            {visiveis.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">Ninguém encontrado.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export type DivergenciaColaborador = {
  id: string;
  tipo: "sem_registro_orqestrai" | "sem_conta_responsum" | "area_diferente" | "status_diferente";
  nome: string | null;
  email: string | null;
  detalhe: string | null;
  detectado_em: string;
};

const ROTULO_TIPO: Record<DivergenciaColaborador["tipo"], string> = {
  sem_registro_orqestrai: "Sem cadastro no ORQESTRAI",
  sem_conta_responsum: "Sem conta no Responsum",
  area_diferente: "Área diferente",
  status_diferente: "Status diferente",
};

export function AtualizarColaboradoresButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await atualizarColaboradores();
          if (!r.ok) {
            toastError(r.error ?? "Falha ao atualizar colaboradores.");
            return;
          }
          const partes = [
            `${r.total ?? 0} no ORQESTRAI`,
            r.criados ? `${r.criados} novo(s)` : null,
            r.desligados ? `${r.desligados} desligado(s)` : null,
            r.areasAtualizadas ? `${r.areasAtualizadas} área(s) de usuário ajustada(s)` : null,
            r.divergencias ? `${r.divergencias} divergência(s)` : null,
            r.falhas ? `${r.falhas} não gravado(s)` : null,
          ].filter(Boolean);
          success(`Colaboradores atualizados: ${partes.join(" · ")}.`);
          router.refresh();
        })
      }
    >
      <RefreshCw size={16} className={clsx(pending && "animate-spin")} />
      {pending ? "Atualizando..." : "Atualizar colaboradores"}
    </Button>
  );
}

export function DivergenciasPanel({
  divergencias,
  ultimoSync,
}: {
  divergencias: DivergenciaColaborador[];
  ultimoSync: string | null;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={divergencias.length === 0}
        className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
      >
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            divergencias.length ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
          )}
        >
          {divergencias.length ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">
            {divergencias.length
              ? `${divergencias.length} divergência(s) entre ORQESTRAI, Responsum e SAMA`
              : "Colaboradores em dia com o ORQESTRAI"}
          </p>
          <p className="text-xs text-slate-500">
            {ultimoSync ? `Última atualização: ${formatDateTime(ultimoSync)}` : "Ainda não atualizado"}
          </p>
        </div>
        {divergencias.length > 0 && (
          <ChevronDown
            size={16}
            className={clsx("shrink-0 text-slate-400 transition-transform", aberto && "rotate-180")}
          />
        )}
      </button>

      {aberto && divergencias.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {divergencias.map((d) => (
            <li key={d.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-fit shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {ROTULO_TIPO[d.tipo]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">
                  {d.nome ?? "—"}
                  {d.email && <span className="ml-2 text-xs text-slate-400">{d.email}</span>}
                </p>
                {d.detalhe && <p className="text-xs text-slate-500">{d.detalhe}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
