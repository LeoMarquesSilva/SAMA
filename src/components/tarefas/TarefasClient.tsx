"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  X,
  Calendar,
  Building2,
  FileText,
  Upload,
  CalendarClock,
  ClipboardList,
  EyeOff,
  Undo2,
  ArrowUpRight,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AvatarGroup, PersonTag } from "@/components/ui/Avatar";
import { PersonSelect } from "@/components/ui/PersonSelect";
import {
  tarefaEnvolveUsuarioId,
  tituloExibicaoTarefa,
  tituloCompletoTarefa,
} from "@/lib/vios-tarefas-utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { AtividadeForm } from "@/components/atividades/AtividadeForm";
import { ReuniaoForm } from "@/components/reunioes/ReuniaoForm";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  buildDescricaoTarefa,
  prefillAtividadeFromTarefa,
  prefillReuniaoFromTarefa,
} from "@/lib/vios-tarefas-prefill";
import { TIPO_ATIVIDADE_INTERNA, type TipoAtividadeKey } from "@/lib/constants";
import { atividadeTipoOptionsVios } from "@/lib/vios-tarefas-tipo-map";
import {
  importarTarefasViosCsv,
  ignorarTarefa,
  reverterTarefa,
  sincronizarTarefasVios,
  vincularTarefaCategorizada,
} from "@/app/(app)/tarefas/actions";
import type { TarefasSyncInfo } from "@/app/(app)/tarefas/actions";
import type { ViosTarefaRow, ViosTarefaStatus } from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { useConfirm } from "@/components/ui/Confirm";

const statusInfo: Record<
  ViosTarefaStatus,
  { label: string; tone: "gray" | "green" | "blue" | "amber" }
> = {
  PENDENTE: { label: "Pendente", tone: "amber" },
  CATEGORIZADO_REUNIAO: { label: "Virou reunião", tone: "green" },
  CATEGORIZADO_ATIVIDADE: { label: "Virou atividade", tone: "blue" },
  IGNORADO: { label: "Ignorado", tone: "gray" },
};

function tarefaStatus(t: ViosTarefaRow): ViosTarefaStatus {
  return t.status ?? "PENDENTE";
}

export function TarefasClient({
  tarefas,
  viosOk,
  ultimaSync,
  syncInfo,
  pessoas,
  usuarios,
  colaboradores,
  isAdmin,
  pessoaAtualId,
}: {
  tarefas: ViosTarefaRow[];
  viosOk: boolean;
  ultimaSync: string | null;
  syncInfo: TarefasSyncInfo;
  pessoas: { nome: string; avatar_url?: string | null }[];
  usuarios: { id: string; nome: string; avatar_url?: string | null }[];
  colaboradores: ColaboradorOpt[];
  isAdmin: boolean;
  pessoaAtualId: string | null;
}) {
  const router = useRouter();
  const { confirm: confirmar } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [importPending, startImportTransition] = useTransition();
  const [msg, setMsg] = useState<string>();
  const [busca, setBusca] = useState("");
  const [fResponsavel, setFResponsavel] = useState("");
  const [fStatus, setFStatus] = useState<string>("PENDENTE");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reuniaoTarefa, setReuniaoTarefa] = useState<ViosTarefaRow | null>(null);
  const [atividadeTarefa, setAtividadeTarefa] = useState<ViosTarefaRow | null>(
    null
  );

  const avatarPorNome = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of pessoas) {
      m.set(p.nome.trim().toLowerCase(), p.avatar_url ?? null);
    }
    return m;
  }, [pessoas]);

  function avatarUrl(nome: string): string | null | undefined {
    return avatarPorNome.get(nome.trim().toLowerCase());
  }

  function pessoasDaTarefa(t: ViosTarefaRow) {
    const nomes = [...(t.responsaveis ?? []), ...(t.auxiliares ?? [])];
    const seen = new Set<string>();
    return nomes
      .map((n) => n.trim())
      .filter((n) => {
        if (!n || seen.has(n.toLowerCase())) return false;
        seen.add(n.toLowerCase());
        return true;
      })
      .map((nome) => ({ nome, avatar_url: avatarUrl(nome) ?? null }));
  }

  const usuariosFiltro = useMemo(
    () =>
      [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [usuarios]
  );

  const filtradoSemStatus = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const usuarioFiltro = fResponsavel
      ? usuarios.find((u) => u.id === fResponsavel)
      : null;
    return tarefas.filter((t) => {
      if (
        usuarioFiltro &&
        !tarefaEnvolveUsuarioId(t, usuarioFiltro)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        t.tarefa,
        t.tarefa_pai,
        t.usuario_concluiu,
        tituloCompletoTarefa(t),
        t.descricao,
        t.cliente,
        t.grupo_cliente,
        t.nro_cnj,
        t.pasta,
        t.area_do_processo,
        ...(t.responsaveis ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tarefas, busca, fResponsavel, usuarios]);

  const filtradas = useMemo(
    () =>
      fStatus === "TODOS"
        ? filtradoSemStatus
        : filtradoSemStatus.filter((t) => tarefaStatus(t) === fStatus),
    [filtradoSemStatus, fStatus]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      PENDENTE: 0,
      CATEGORIZADO_REUNIAO: 0,
      CATEGORIZADO_ATIVIDADE: 0,
      IGNORADO: 0,
      TODOS: filtradoSemStatus.length,
    };
    for (const t of filtradoSemStatus) {
      const s = tarefaStatus(t);
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [filtradoSemStatus]);

  const pendentes = counts.PENDENTE ?? 0;

  const syncPermitido = syncInfo.permissao.permitido;

  function ignorar(id: string) {
    startTransition(async () => {
      await ignorarTarefa(id);
      router.refresh();
    });
  }

  function reverter(id: string) {
    startTransition(async () => {
      await reverterTarefa(id);
      router.refresh();
    });
  }

  async function handleSync() {
    if (!syncPermitido) {
      setMsg(syncInfo.permissao.motivo ?? "Sync indisponível no momento.");
      return;
    }

    const ok = await confirmar({
      title: "Sincronizar tarefas do VIOS?",
      message: `A API permite apenas ${syncInfo.cotaRequests} consultas a cada ${Math.round(syncInfo.cotaJanelaMinutos / 60)} horas. O SAMA aguarda no mínimo ${syncInfo.cooldownMinutos} minutos entre syncs. Deseja continuar?`,
      confirmLabel: "Sincronizar",
      tone: "warning",
    });
    if (!ok) return;

    setMsg(undefined);
    startTransition(async () => {
      const r = await sincronizarTarefasVios(undefined, { forcar: true });
      if (!r.ok) setMsg(r.error ?? "Erro ao sincronizar.");
      else
        setMsg(
          r.importados
            ? `${r.importados} tarefa(s) importada(s) do VIOS.`
            : "Nenhuma tarefa no período consultado."
        );
      router.refresh();
    });
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setMsg(undefined);
    startImportTransition(async () => {
      const fd = new FormData();
      fd.set("arquivo", file);
      const r = await importarTarefasViosCsv(fd);
      if (!r.ok) setMsg(r.error ?? "Erro ao importar CSV.");
      else if (r.importados === 0)
        setMsg(
          r.error ??
            `Nenhuma tarefa cumprida por Sócio de Área (${r.totalCsv ?? 0} linha(s) no CSV).`
        );
      else {
        const partes = [
          `${r.importados?.toLocaleString("pt-BR") ?? 0} tarefa(s) importada(s) (${r.totalCsv?.toLocaleString("pt-BR") ?? 0} no CSV)`,
        ];
        for (const [tipo, qtd] of Object.entries(r.classificadas ?? {})) {
          if (!qtd) continue;
          const label =
            TIPO_ATIVIDADE_INTERNA[tipo as TipoAtividadeKey] ?? tipo;
          partes.push(`${qtd} ${label} já classificada(s)`);
        }
        setMsg(partes.join(" · "));
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tarefas VIOS</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {pendentes.toLocaleString("pt-BR")} tarefa(s) pendente(s) de
            categorização
            {ultimaSync && (
              <span className="ml-1 text-slate-400">
                · última sync {formatDateTime(ultimaSync)}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="secondary"
            onClick={handleImportClick}
            disabled={importPending || pending}
          >
            <Upload
              size={16}
              className={clsx(importPending && "animate-pulse")}
            />
            Importar CSV
          </Button>
          <Button
            onClick={handleSync}
            disabled={pending || importPending || !viosOk || !syncPermitido}
            title={!syncPermitido ? syncInfo.permissao.motivo : undefined}
          >
            <RefreshCw size={16} className={clsx(pending && "animate-spin")} />
            Sincronizar API
          </Button>
        </div>
      </div>

      <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Exibindo apenas tarefas <strong>cumpridas</strong> por{" "}
        <strong>Sócio de Área</strong>, com base na coluna &quot;Usuário que
        concluiu a tarefa&quot; do VIOS.
      </p>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Com a cota da API esgotada, use <strong>Importar CSV</strong> com o
        relatório baixado no VIOS. Não consome requisições da API.
      </p>

      {!syncPermitido && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {syncInfo.permissao.motivo}
          {tarefas.length > 0 && (
            <span className="mt-1 block text-amber-700/90">
              Exibindo {tarefas.length.toLocaleString("pt-BR")} tarefa(s) já
              importadas no banco.
            </span>
          )}
        </p>
      )}

      {syncPermitido && viosOk && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Cota VIOS: até {syncInfo.cotaRequests} consultas a cada{" "}
          {Math.round(syncInfo.cotaJanelaMinutos / 60)} h · intervalo mínimo de{" "}
          {syncInfo.cooldownMinutos} min entre syncs.
        </p>
      )}

      {!viosOk && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Configure <code>VIOS_TOKEN</code> no <code>.env.local</code> para
          consultar a API do VIOS.
        </p>
      )}

      {msg && (
        <p
          className={clsx(
            "rounded-lg px-3 py-2 text-sm",
            msg.includes("importada") || msg.includes("Nenhuma tarefa")
              ? "bg-emerald-50 text-emerald-700"
              : msg.includes("Cota") ||
                  msg.includes("Limite") ||
                  msg.includes("Aguarde") ||
                  msg.includes("continuam disponíveis")
                ? "bg-amber-50 text-amber-800"
                : "bg-red-50 text-red-700"
          )}
        >
          {msg}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "PENDENTE", label: "Pendentes" },
            { key: "CATEGORIZADO_REUNIAO", label: "Reuniões" },
            { key: "CATEGORIZADO_ATIVIDADE", label: "Atividades" },
            { key: "IGNORADO", label: "Ignorados" },
            { key: "TODOS", label: "Todos" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFStatus(f.key)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
              fStatus === f.key
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {f.label}
            <span
              className={clsx(
                "rounded-full px-1.5 text-[11px] font-semibold",
                fStatus === f.key
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Buscar por tarefa, cliente, processo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-9 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {usuariosFiltro.length > 0 && (
          <PersonSelect
            pessoas={usuariosFiltro}
            value={fResponsavel}
            onChange={setFResponsavel}
            placeholder="Todos responsáveis"
            emptyLabel="Todos responsáveis"
            className="min-w-[220px]"
          />
        )}
      </div>

      <p className="text-xs text-slate-400">
        {filtradas.length.toLocaleString("pt-BR")} de{" "}
        {tarefas.length.toLocaleString("pt-BR")} tarefa(s)
      </p>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            tarefas.length ? "Nenhuma tarefa neste filtro" : "Nenhuma tarefa importada"
          }
          description={
            tarefas.length
              ? "Ajuste a busca ou o filtro de responsável."
              : "Clique em Importar CSV ou aguarde a liberação da API VIOS."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtradas.map((t) => (
            <TarefaCard
              key={t.id}
              t={t}
              expanded={expanded === t.id}
              onToggleExpand={() =>
                setExpanded(expanded === t.id ? null : t.id)
              }
              pessoasTarefa={pessoasDaTarefa(t)}
              pending={pending}
              onReuniao={() => setReuniaoTarefa(t)}
              onAtividade={() => setAtividadeTarefa(t)}
              onIgnorar={() => ignorar(t.id)}
              onReverter={() => reverter(t.id)}
            />
          ))}
        </div>
      )}

      {reuniaoTarefa && (
        <ReuniaoForm
          open={true}
          onClose={() => setReuniaoTarefa(null)}
          onSaved={() => router.refresh()}
          prefill={prefillReuniaoFromTarefa(reuniaoTarefa)}
          afterCreate={async (id) => {
            await vincularTarefaCategorizada(reuniaoTarefa.id, "REUNIAO", id);
          }}
          colaboradores={colaboradores}
        />
      )}

      {atividadeTarefa && (
        <AtividadeForm
          open={true}
          onClose={() => setAtividadeTarefa(null)}
          onSaved={() => router.refresh()}
          prefill={prefillAtividadeFromTarefa(atividadeTarefa)}
          afterCreate={async (id) => {
            await vincularTarefaCategorizada(
              atividadeTarefa.id,
              "ATIVIDADE",
              id
            );
          }}
          pessoas={usuarios}
          podeEscolherPessoa={isAdmin}
          pessoaAtualId={pessoaAtualId}
          tipoOptions={atividadeTipoOptionsVios()}
        />
      )}
    </div>
  );
}

function TarefaTitulo({ t }: { t: ViosTarefaRow }) {
  const { titulo, tarefaPai } = tituloExibicaoTarefa(t);
  return (
    <span className="font-medium text-slate-800">
      {titulo}
      {tarefaPai && (
        <span className="font-normal text-slate-400"> · {tarefaPai}</span>
      )}
    </span>
  );
}

function TarefaCard({
  t,
  expanded,
  onToggleExpand,
  pessoasTarefa,
  pending,
  onReuniao,
  onAtividade,
  onIgnorar,
  onReverter,
}: {
  t: ViosTarefaRow;
  expanded: boolean;
  onToggleExpand: () => void;
  pessoasTarefa: { nome: string; avatar_url: string | null }[];
  pending: boolean;
  onReuniao: () => void;
  onAtividade: () => void;
  onIgnorar: () => void;
  onReverter: () => void;
}) {
  const status = tarefaStatus(t);
  const s = statusInfo[status];
  const atrasada =
    status === "PENDENTE" &&
    t.data_limite &&
    new Date(t.data_limite) < new Date(new Date().toDateString());
  const descricao = buildDescricaoTarefa(t);

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={onToggleExpand}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <TarefaTitulo t={t} />
              <Badge tone={s.tone}>{s.label}</Badge>
              {atrasada && <Badge tone="red">Prazo vencido</Badge>}
            </div>
            {t.cliente && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <Building2 size={14} />
                {t.cliente}
                {t.grupo_cliente && (
                  <span className="text-slate-400">· {t.grupo_cliente}</span>
                )}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              {t.data_limite && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  Limite {formatDate(t.data_limite)}
                </span>
              )}
              {t.data_conclusao && (
                <span className="inline-flex items-center gap-1">
                  Concluída {formatDate(t.data_conclusao)}
                </span>
              )}
              {t.usuario_concluiu && (
                <span className="inline-flex items-center gap-1">
                  por {t.usuario_concluiu}
                </span>
              )}
              {t.nro_cnj && <span className="font-mono">{t.nro_cnj}</span>}
            </div>
          </button>
          {pessoasTarefa.length > 0 && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <AvatarGroup pessoas={pessoasTarefa} max={4} size={28} />
            </div>
          )}
        </div>

        {descricao && !expanded && (
          <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs text-slate-500">
            {descricao}
          </p>
        )}

        {expanded && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {pessoasTarefa.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pessoasTarefa.map((p) => (
                  <span
                    key={p.nome}
                    className="inline-flex items-center rounded-full bg-slate-50 py-0.5 pl-0.5 pr-2.5 ring-1 ring-slate-200"
                  >
                    <PersonTag nome={p.nome} src={p.avatar_url} size={22} />
                  </span>
                ))}
              </div>
            )}
            {descricao && (
              <p className="whitespace-pre-wrap">{descricao}</p>
            )}
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {t.area_do_processo && (
                <>
                  <dt className="text-xs text-slate-400">Área</dt>
                  <dd>{t.area_do_processo}</dd>
                </>
              )}
              {t.pasta && (
                <>
                  <dt className="text-xs text-slate-400">Pasta</dt>
                  <dd>{t.pasta}</dd>
                </>
              )}
              {t.objeto_do_processo && (
                <>
                  <dt className="text-xs text-slate-400">Objeto</dt>
                  <dd>{t.objeto_do_processo}</dd>
                </>
              )}
            </dl>
            {(t.comentarios?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-400">Comentários</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {t.comentarios.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {status === "CATEGORIZADO_ATIVIDADE" && t.atividade_id && (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <Link
              href="/calendario"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ver atividade registrada
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}

        {status === "CATEGORIZADO_REUNIAO" && t.reuniao_id && (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <Link
              href="/calendario"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ver no calendário
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}

        {status === "PENDENTE" ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button size="sm" onClick={onReuniao}>
              <CalendarClock size={15} /> Reclassificação Reunião
            </Button>
            <Button size="sm" variant="secondary" onClick={onAtividade}>
              <ClipboardList size={15} /> Reclassificação Atividade
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={onIgnorar}>
              <EyeOff size={15} /> Ignorar
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <Button size="sm" variant="ghost" disabled={pending} onClick={onReverter}>
              <Undo2 size={15} /> Voltar para pendente
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
