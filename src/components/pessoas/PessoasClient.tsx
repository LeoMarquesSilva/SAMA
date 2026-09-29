"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Plus, Pencil, Trash2, Power, PowerOff, ShieldCheck, LayoutGrid, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PessoaForm } from "./PessoaForm";
import { CARGO_PESSOA, cargoPessoaLabel, departamentoCanonico } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  deletePessoa,
  ativarPessoa,
  desativarPessoa,
  ativarPendentes,
} from "@/app/(app)/pessoas/actions";
import type { Pessoa } from "@/types/database";
import { MODULOS } from "@/lib/modulos";
import { ModulosModal } from "./ModulosModal";
import {
  AtualizarColaboradoresButton,
  ColaboradoresSemAcessoPanel,
  DivergenciasPanel,
  type ColaboradorSemAcesso,
  type DivergenciaColaborador,
} from "./ColaboradoresSync";

export type { DivergenciaColaborador };

function ModulosResumo({ p, modulos }: { p: Pessoa; modulos: string[] }) {
  if (p.is_admin) return <Badge tone="blue">Todos (admin)</Badge>;
  if (modulos.length === 0) return <span className="text-xs text-slate-400">Nenhum</span>;
  const nomes = MODULOS.filter((m) => modulos.includes(m.key)).map((m) => m.label);
  return (
    <span className="text-xs text-slate-600" title={nomes.join(", ")}>
      {nomes.length} de {MODULOS.length}
      <span className="ml-1 hidden text-slate-400 xl:inline">· {nomes.slice(0, 3).join(", ")}{nomes.length > 3 ? "…" : ""}</span>
    </span>
  );
}

function LoginBadge({ p }: { p: Pessoa }) {
  if (!p.ativo) return <Badge tone="gray">Desativado</Badge>;
  return (
    <Badge tone="green">
      {p.senha_provisoria ? "Ativo · senha provisória" : "Ativo"}
    </Badge>
  );
}

function UltimoAcesso({ p }: { p: Pessoa }) {
  if (!p.ativo || !p.auth_user_id) {
    return <span className="text-slate-400">—</span>;
  }
  if (!p.ultimo_acesso_em) {
    return <span className="text-slate-400">Nunca</span>;
  }
  return (
    <time
      dateTime={p.ultimo_acesso_em}
      className="whitespace-nowrap text-slate-600"
      title={formatDateTime(p.ultimo_acesso_em)}
    >
      {formatDateTime(p.ultimo_acesso_em)}
    </time>
  );
}

function LoginCell({ p, showUltimoAcesso }: { p: Pessoa; showUltimoAcesso?: boolean }) {
  return (
    <div className="space-y-1">
      <LoginBadge p={p} />
      {showUltimoAcesso && (
        <p className="text-xs text-slate-500">
          Último acesso: <UltimoAcesso p={p} />
        </p>
      )}
    </div>
  );
}

type Situacao = "" | "ativos" | "provisoria" | "desativados" | "nunca";

const SITUACOES: { key: Situacao; label: string; soAdmin?: boolean }[] = [
  { key: "", label: "Todos" },
  { key: "ativos", label: "Com login" },
  { key: "provisoria", label: "Senha provisória" },
  { key: "desativados", label: "Desativados" },
  { key: "nunca", label: "Nunca acessou", soAdmin: true },
];

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function PessoasClient({
  pessoas,
  autoNew = false,
  isAdmin = false,
  showUltimoAcesso = false,
  modulosPorUsuario = {},
  divergencias = [],
  ultimoSync = null,
  semAcesso = [],
}: {
  pessoas: Pessoa[];
  autoNew?: boolean;
  isAdmin?: boolean;
  showUltimoAcesso?: boolean;
  modulosPorUsuario?: Record<string, string[]>;
  divergencias?: DivergenciaColaborador[];
  ultimoSync?: string | null;
  semAcesso?: ColaboradorSemAcesso[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Pessoa | null>(null);
  const [modulosDe, setModulosDe] = useState<Pessoa | null>(null);
  const modulosDa = (p: Pessoa) => modulosPorUsuario[p.id] ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("");
  const [area, setArea] = useState("");
  const [cargo, setCargo] = useState("");
  const [perfil, setPerfil] = useState("");
  const [modulo, setModulo] = useState("");

  const areas = useMemo(
    () =>
      [
        ...new Set(
          pessoas.map((p) => departamentoCanonico(p.departamento)).filter((d): d is string => Boolean(d))
        ),
      ]
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((d) => ({ value: d, label: d })),
    [pessoas]
  );

  const filtrosAtivos = [busca.trim(), situacao, area, cargo, perfil, modulo].filter(Boolean).length;

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas.filter((p) => {
      if (termo && !semAcento(`${p.nome} ${p.email}`).includes(termo)) return false;
      if (situacao === "ativos" && !p.ativo) return false;
      if (situacao === "provisoria" && !(p.ativo && p.senha_provisoria)) return false;
      if (situacao === "desativados" && p.ativo) return false;
      if (situacao === "nunca" && !(p.ativo && !p.ultimo_acesso_em)) return false;
      if (area === "__sem" ? p.departamento : area && departamentoCanonico(p.departamento) !== area)
        return false;
      if (cargo && p.cargo !== cargo) return false;
      if (perfil === "admin" && !p.is_admin) return false;
      if (perfil === "comum" && p.is_admin) return false;
      if (modulo && !p.is_admin && !(modulosPorUsuario[p.id] ?? []).includes(modulo)) return false;
      return true;
    });
  }, [pessoas, busca, situacao, area, cargo, perfil, modulo, modulosPorUsuario]);

  function limparFiltros() {
    setBusca("");
    setSituacao("");
    setArea("");
    setCargo("");
    setPerfil("");
    setModulo("");
  }

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setModulosDe(p)}
          title="Módulos liberados"
          aria-label="Módulos liberados"
        >
          <LayoutGrid size={16} className="text-brand-600" />
        </Button>
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
            {isAdmin && semAcesso.length > 0 && ` · ${semAcesso.length} colaboradores sem acesso`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <AtualizarColaboradoresButton />}
          {isAdmin && pessoas.some((p) => !p.ativo) && (
            <Button
              variant="secondary"
              disabled={busyId === "lote"}
              onClick={() => {
                startTransition(async () => {
                  setBusyId("lote");
                  const r = await ativarPendentes();
                  setBusyId(null);
                  if (!r.ok) toastError(r.error ?? "Falha ao ativar pendentes.");
                  else success(`${r.ativados ?? 0} login(s) ativado(s).`);
                  router.refresh();
                });
              }}
            >
              <Power size={16} />
              Ativar pendentes
            </Button>
          )}
          <Button onClick={openNew} disabled={!isAdmin}>
            <Plus size={16} />
            <span className="hidden sm:inline">Nova pessoa</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {isAdmin && <DivergenciasPanel divergencias={divergencias} ultimoSync={ultimoSync} />}

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-brand-400 sm:basis-64">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
          <SelectMenu
            value={area}
            onChange={setArea}
            emptyOption="Todas as áreas"
            placeholder="Todas as áreas"
            options={[...areas, { value: "__sem", label: "Sem área" }]}
            className="w-full sm:w-52"
          />
          <SelectMenu
            value={cargo}
            onChange={setCargo}
            emptyOption="Todos os cargos"
            placeholder="Todos os cargos"
            options={Object.entries(CARGO_PESSOA).map(([value, label]) => ({ value, label }))}
            className="w-full sm:w-44"
          />
          <SelectMenu
            value={perfil}
            onChange={setPerfil}
            emptyOption="Todos os perfis"
            placeholder="Todos os perfis"
            options={[
              { value: "admin", label: "Administradores" },
              { value: "comum", label: "Não administradores" },
            ]}
            className="w-full sm:w-48"
          />
          <SelectMenu
            value={modulo}
            onChange={setModulo}
            emptyOption="Qualquer módulo"
            placeholder="Qualquer módulo"
            options={MODULOS.map((m) => ({ value: m.key, label: `Acessa ${m.label}` }))}
            className="w-full sm:w-52"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1">
            {SITUACOES.filter((s) => !s.soAdmin || showUltimoAcesso).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSituacao(s.key)}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm font-medium transition",
                  situacao === s.key ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-500">
            {filtradas.length} de {pessoas.length}
          </span>
          {filtrosAtivos > 0 && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X size={14} />
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* MOBILE: cards */}
      <div className="space-y-3 md:hidden">
        {pessoas.length > 0 && filtradas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Ninguém com esses filtros.
          </p>
        )}
        {pessoas.length === 0 && (
          <EmptyState
            title="Nenhuma pessoa cadastrada ainda"
            description="Cadastre os sócios e colaboradores que vão usar o sistema."
            actionLabel="Nova pessoa"
            onAction={openNew}
          />
        )}
        {filtradas.map((p) => (
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
                  <span>{cargoPessoaLabel(p.cargo, p.departamento)}</span>
                  {p.departamento && (
                    <>
                      <span>·</span>
                      <span>{p.departamento}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="space-y-1">
                <LoginCell p={p} showUltimoAcesso={showUltimoAcesso} />
                <p className="text-xs text-slate-500">
                  Módulos: <ModulosResumo p={p} modulos={modulosDa(p)} />
                </p>
              </div>
              <Acoes p={p} />
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP: tabela */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              <th className="px-4 py-3 font-medium">Departamento</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Login</th>
              <th className="px-4 py-3 font-medium">Módulos</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pessoas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Nenhuma pessoa cadastrada ainda.
                </td>
              </tr>
            )}
            {pessoas.length > 0 && filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Ninguém com esses filtros.
                </td>
              </tr>
            )}
            {filtradas.map((p) => (
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
                <td className="px-4 py-3 text-slate-600">
                  {cargoPessoaLabel(p.cargo, p.departamento)}
                </td>
                <td className="px-4 py-3">
                  <LoginCell p={p} showUltimoAcesso={showUltimoAcesso} />
                </td>
                <td className="px-4 py-3">
                  <ModulosResumo p={p} modulos={modulosDa(p)} />
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

      {isAdmin && <ColaboradoresSemAcessoPanel colaboradores={semAcesso} />}

      <PessoaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => router.refresh()}
        pessoa={editing}
      />

      {modulosDe && (
        <ModulosModal
          key={modulosDe.id}
          pessoa={modulosDe}
          modulos={modulosDa(modulosDe)}
          onClose={() => setModulosDe(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
