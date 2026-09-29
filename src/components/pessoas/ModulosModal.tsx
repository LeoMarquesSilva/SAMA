"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { MODULOS, MODULOS_PADRAO } from "@/lib/modulos";
import { salvarModulosUsuario } from "@/app/(app)/pessoas/actions";
import type { Pessoa } from "@/types/database";

function Interruptor({
  ligado,
  disabled,
  onChange,
  label,
}: {
  ligado: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!ligado)}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
        ligado ? "bg-brand-600" : "bg-slate-200",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span
        className={clsx(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          ligado ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function ModulosModal({
  pessoa,
  modulos,
  onClose,
  onSaved,
}: {
  pessoa: Pessoa | null;
  modulos: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(modulos));
  const [pending, startTransition] = useTransition();
  const { success, error: toastError } = useToast();

  if (!pessoa) return null;
  const admin = pessoa.is_admin;

  function alternar(key: string, on: boolean) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (on) novo.add(key);
      else novo.delete(key);
      return novo;
    });
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarModulosUsuario(pessoa!.id, [...selecionados]);
      if (!r.ok) {
        toastError(r.error ?? "Erro ao salvar módulos.");
        return;
      }
      success("Módulos atualizados.");
      onSaved();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose} title="Módulos liberados" size="lg" closeDisabled={pending}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <Avatar nome={pessoa.nome} src={pessoa.avatar_url} size={36} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{pessoa.nome}</p>
            <p className="truncate text-xs text-slate-400">{pessoa.email}</p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-slate-500">
            {admin ? "Todos" : `${selecionados.size} de ${MODULOS.length}`}
          </span>
        </div>

        {admin && (
          <p className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            Administradores acessam todos os módulos. Os ajustes abaixo passam a valer se a
            pessoa deixar de ser administradora.
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setSelecionados(new Set(MODULOS.map((m) => m.key)))}
          >
            Liberar todos
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setSelecionados(new Set(MODULOS_PADRAO))}
          >
            Só o padrão
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setSelecionados(new Set())}
          >
            Remover todos
          </button>
        </div>

        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {MODULOS.map((m) => {
            const ligado = selecionados.has(m.key);
            return (
              <li key={m.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.descricao}</p>
                </div>
                <Interruptor
                  ligado={ligado}
                  disabled={pending}
                  onChange={(v) => alternar(m.key, v)}
                  label={`Liberar ${m.label}`}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={pending}>
            {pending ? "Salvando..." : "Salvar módulos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
