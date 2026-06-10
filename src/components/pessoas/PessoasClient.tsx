"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Power, PowerOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PessoaForm } from "./PessoaForm";
import { CARGO_PESSOA } from "@/lib/constants";
import {
  deletePessoa,
  ativarPessoa,
  desativarPessoa,
} from "@/app/(app)/pessoas/actions";
import type { Pessoa } from "@/types/database";

function LoginBadge({ p }: { p: Pessoa }) {
  if (!p.ativo) return <Badge tone="gray">Desativado</Badge>;
  return (
    <Badge tone="green">
      {p.senha_provisoria ? "Ativo · senha provisória" : "Ativo"}
    </Badge>
  );
}

export function PessoasClient({
  pessoas,
  autoNew = false,
  isAdmin = false,
}: {
  pessoas: Pessoa[];
  autoNew?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (autoNew) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [autoNew]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Pessoa) {
    setEditing(p);
    setFormOpen(true);
  }

  const { success, error: toastError } = useToast();
  const { confirm: confirmar } = useConfirm();

  function run(
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string
  ) {
    setBusyId(id);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toastError(r.error ?? "Algo deu errado.");
      else if (okMsg) success(okMsg);
      setBusyId(null);
      router.refresh();
    });
  }

  async function handleDelete(p: Pessoa) {
    const ok = await confirmar({
      title: "Excluir pessoa?",
      message: `"${p.nome}" será removida permanentemente. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    run(p.id, () => deletePessoa(p.id), "Pessoa excluída.");
  }
  async function handleAtivar(p: Pessoa) {
    const ok = await confirmar({
      title: `Ativar ${p.nome}?`,
      message:
        "Será criado um login com a senha padrão 123456, que o usuário deverá trocar no primeiro acesso.",
      confirmLabel: "Ativar acesso",
      tone: "warning",
    });
    if (!ok) return;
    run(p.id, () => ativarPessoa(p.id), "Acesso ativado.");
  }
  async function handleDesativar(p: Pessoa) {
    const ok = await confirmar({
      title: `Desativar ${p.nome}?`,
      message: "O login será removido. Os registros da pessoa permanecem.",
      confirmLabel: "Desativar",
      tone: "warning",
    });
    if (!ok) return;
    run(p.id, () => desativarPessoa(p.id), "Acesso desativado.");
  }

  function Acoes({ p }: { p: Pessoa }) {
    if (!isAdmin) return null;
    return (
      <div className="flex gap-1">
        {p.ativo ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === p.id}
            onClick={() => handleDesativar(p)}
            title="Desativar (remover login)"
          >
            <PowerOff size={16} className="text-amber-600" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === p.id}
            onClick={() => handleAtivar(p)}
            title="Ativar (criar login)"
          >
            <Power size={16} className="text-emerald-600" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label="Editar">
          <Pencil size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busyId === p.id}
          onClick={() => handleDelete(p)}
          aria-label="Excluir"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">Usuários</h1>
          <p className="text-sm text-slate-500">
            {pessoas.length} cadastradas · {pessoas.filter((p) => p.ativo).length}{" "}
            com login
          </p>
        </div>
        <Button onClick={openNew} disabled={!isAdmin}>
          <Plus size={16} />
          <span className="hidden sm:inline">Nova pessoa</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* MOBILE: cards */}
      <div className="space-y-3 md:hidden">
        {pessoas.length === 0 && (
          <EmptyState
            title="Nenhuma pessoa cadastrada ainda"
            description="Cadastre os sócios e colaboradores que vão usar o sistema."
            actionLabel="Nova pessoa"
            onAction={openNew}
          />
        )}
        {pessoas.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar nome={p.nome} src={p.avatar_url} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold text-slate-800">
                    {p.nome}
                  </span>
                  {p.is_admin && (
                    <ShieldCheck size={14} className="shrink-0 text-brand-600" />
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">{p.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>{CARGO_PESSOA[p.cargo]}</span>
                  {p.departamento && (
                    <>
                      <span>·</span>
                      <span>{p.departamento}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <LoginBadge p={p} />
              <Acoes p={p} />
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP: tabela */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Departamento</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Login</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pessoas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Nenhuma pessoa cadastrada ainda.
                </td>
              </tr>
            )}
            {pessoas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar nome={p.nome} src={p.avatar_url} />
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        {p.nome}
                        {p.is_admin && (
                          <ShieldCheck size={14} className="text-brand-600" />
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{p.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.departamento ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{CARGO_PESSOA[p.cargo]}</td>
                <td className="px-4 py-3">
                  <LoginBadge p={p} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Acoes p={p} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PessoaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => router.refresh()}
        pessoa={editing}
      />
    </div>
  );
}
