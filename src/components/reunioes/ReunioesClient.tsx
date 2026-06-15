"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Plus,
  Pencil,
  Trash2,
  Ban,
  CheckCircle2,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  Building2,
  Link2,
  Crown,
  ArrowUpRight,
  CalendarPlus,
  Download,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ReuniaoForm } from "./ReuniaoForm";
import {
  TIPO_REUNIAO,
  TIPO_REUNIAO_TONE,
  MODALIDADE_REUNIAO,
  STATUS_REUNIAO,
  tipoReuniaoOptions,
} from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/format";
import { labelGrupoCliente } from "@/lib/clientes";
import {
  deleteReuniao,
  cancelarReuniao,
  mudarStatusReuniao,
  importarFellowReuniao,
} from "@/app/(app)/reunioes/actions";
import type {
  ReuniaoComRelacoes,
  TipoReuniao,
  StatusReuniao,
} from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { parseChecklist } from "@/lib/proximos-passos-checklist";

const tipoTone = TIPO_REUNIAO_TONE;
const statusTone: Record<StatusReuniao, "green" | "gray" | "red" | "amber"> = {
  REALIZADA: "green",
  AGENDADA: "gray",
  CANCELADA: "red",
  REAGENDADA: "amber",
};

export function ReunioesClient({
  reunioes,
  colaboradores,
  autoNew = false,
  prefillCliente = null,
  fellowAtivo = false,
}: {
  reunioes: ReuniaoComRelacoes[];
  colaboradores: ColaboradorOpt[];
  autoNew?: boolean;
  prefillCliente?: {
    ci: string;
    nome: string;
    grupo_cliente?: string | null;
  } | null;
  fellowAtivo?: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReuniaoComRelacoes | null>(null);
  const [fTipo, setFTipo] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (autoNew) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [autoNew]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return reunioes.filter((r) => {
      if (fTipo && r.tipo !== fTipo) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (q) {
        const hay = [
          r.titulo,
          r.cliente?.nome,
          r.cliente?.grupo_cliente,
          r.tema,
          r.local,
          ...(r.participantes ?? []).map((p) => p.colaborador?.nome),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reunioes, fTipo, fStatus, busca]);

  // Agrupa em Hoje / Próximas / Anteriores (passadas mais recentes primeiro).
  const grupos = useMemo(() => {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date();
    fimHoje.setHours(23, 59, 59, 999);

    const hoje: ReuniaoComRelacoes[] = [];
    const proximas: ReuniaoComRelacoes[] = [];
    const anteriores: ReuniaoComRelacoes[] = [];
    for (const r of filtradas) {
      const d = new Date(r.data_hora_inicio);
      if (d >= inicioHoje && d <= fimHoje) hoje.push(r);
      else if (d > fimHoje) proximas.push(r);
      else anteriores.push(r);
    }
    const asc = (a: ReuniaoComRelacoes, b: ReuniaoComRelacoes) =>
      +new Date(a.data_hora_inicio) - +new Date(b.data_hora_inicio);
    hoje.sort(asc);
    proximas.sort(asc);
    return [
      { label: "Hoje", items: hoje },
      { label: "Próximas", items: proximas },
      { label: "Anteriores", items: anteriores },
    ].filter((g) => g.items.length > 0);
  }, [filtradas]);

  const totais = useMemo(() => {
    const t = {
      total: reunioes.length,
      REALIZADA: 0,
      CANCELADA: 0,
      AGENDADA: 0,
      ...Object.fromEntries(Object.keys(TIPO_REUNIAO).map((k) => [k, 0])),
    } as Record<string, number>;
    for (const r of reunioes) {
      t[r.tipo] = (t[r.tipo] ?? 0) + 1;
      t[r.status] = (t[r.status] ?? 0) + 1;
    }
    return t;
  }, [reunioes]);

  const { success, error: toastError } = useToast();
  const { confirm: confirmar, confirmWithInput } = useConfirm();

  function run(
    id: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string
  ) {
    setBusyId(id);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toastError(r.error ?? "Algo deu errado.");
      else success(okMsg ?? r.error ?? "Concluído.");
      setBusyId(null);
      router.refresh();
    });
  }
  async function handleCancelar(r: ReuniaoComRelacoes) {
    const motivo = await confirmWithInput({
      title: "Cancelar reunião?",
      message: `"${r.titulo}" será marcada como cancelada.`,
      confirmLabel: "Cancelar reunião",
      tone: "warning",
      input: { label: "Motivo do cancelamento", required: true },
    });
    if (motivo === null) return;
    run(r.id, () => cancelarReuniao(r.id, motivo), "Reunião cancelada.");
  }
  function handleRealizada(r: ReuniaoComRelacoes) {
    run(
      r.id,
      () => mudarStatusReuniao(r.id, "REALIZADA"),
      "Reunião marcada como realizada."
    );
  }
  async function handleDelete(r: ReuniaoComRelacoes) {
    const ok = await confirmar({
      title: "Excluir reunião?",
      message: `"${r.titulo}" será removida permanentemente.`,
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    run(r.id, () => deleteReuniao(r.id), "Reunião excluída.");
  }

  async function handleImportarFellow(r: ReuniaoComRelacoes) {
    const ok = await confirmar({
      title: "Importar do Fellow?",
      message: `Buscar resumo e ações da gravação Fellow para "${r.titulo}" e salvar na reunião.`,
      confirmLabel: "Importar",
    });
    if (!ok) return;
    run(
      r.id,
      async () => {
        const res = await importarFellowReuniao(r.id);
        if (!res.ok) return res;
        const partes = ["Conteúdo Fellow importado."];
        if (res.tem_resumo_ia) partes.push("resumo");
        if (res.proximos_passos) partes.push("ações");
        return { ok: true, error: partes.join(" · ") };
      },
      undefined
    );
  }

  function ModalidadeIcon({ m, size = 14 }: { m: string; size?: number }) {
    if (m === "ONLINE") return <Video size={size} />;
    if (m === "PRESENCIAL_EXTERNO") return <MapPin size={size} />;
    return <Building2 size={size} />;
  }

  function Acoes({ r }: { r: ReuniaoComRelacoes }) {
    return (
      <div className="flex gap-1">
        {r.status === "AGENDADA" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === r.id}
            onClick={() => handleRealizada(r)}
            title="Marcar como realizada"
          >
            <CheckCircle2 size={16} className="text-emerald-600" />
          </Button>
        )}
        {r.status !== "CANCELADA" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === r.id}
            onClick={() => handleCancelar(r)}
            title="Cancelar"
          >
            <Ban size={16} className="text-amber-600" />
          </Button>
        )}
        {fellowAtivo && r.modalidade === "ONLINE" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busyId === r.id}
            onClick={() => handleImportarFellow(r)}
            title="Importar resumo e ações do Fellow"
          >
            <Download size={16} className="text-brand-600" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(r);
            setFormOpen(true);
          }}
          aria-label="Editar"
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busyId === r.id}
          onClick={() => handleDelete(r)}
          aria-label="Excluir"
        >
          <Trash2 size={16} className="text-red-500" />
        </Button>
      </div>
    );
  }

  const tipoAccent: Record<TipoReuniao, string> = {
    CAPTACAO: "before:bg-brand-500",
    FIDELIZACAO: "before:bg-emerald-500",
    RELACIONAMENTO_INSTITUCIONAL: "before:bg-amber-500",
    GESTAO_ESTRATEGICA: "before:bg-violet-500",
    GESTAO_EQUIPE: "before:bg-slate-500",
    GESTAO_OPERACIONAL: "before:bg-red-500",
  };

  function ReuniaoCard({ r }: { r: ReuniaoComRelacoes }) {
    const parts = r.participantes ?? [];
    return (
      <article
        className={clsx(
          "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
          "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
          tipoAccent[r.tipo] ?? "before:bg-slate-300"
        )}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 pl-1.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tipoTone[r.tipo] ?? "gray"}>
                {TIPO_REUNIAO[r.tipo] ?? r.tipo}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <ModalidadeIcon m={r.modalidade} />
                {MODALIDADE_REUNIAO[r.modalidade]}
              </span>
            </div>
            <h3 className="mt-1.5 text-base font-semibold leading-snug text-slate-800">
              {r.titulo}
            </h3>
          </div>
          <Badge tone={statusTone[r.status]}>{STATUS_REUNIAO[r.status]}</Badge>
        </div>

        {/* Metadados */}
        <div className="mt-3 grid grid-cols-1 gap-1.5 pl-1.5 text-sm text-slate-600 sm:grid-cols-2">
          <span className="inline-flex items-center gap-2">
            <Calendar size={15} className="shrink-0 text-slate-400" />
            {formatDateTime(r.data_hora_inicio)}
          </span>
          {r.duracao_minutos ? (
            <span className="inline-flex items-center gap-2">
              <Clock size={15} className="shrink-0 text-slate-400" />
              {formatDuration(r.duracao_minutos)}
            </span>
          ) : null}
          {r.cliente?.nome && (
            <span className="inline-flex items-center gap-2">
              <Building2 size={15} className="shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block truncate">{r.cliente.nome}</span>
                <span className="block truncate text-xs text-slate-400">
                  {labelGrupoCliente(r.cliente.grupo_cliente)}
                </span>
              </span>
            </span>
          )}
          {r.modalidade !== "ONLINE" && r.local && (
            <span className="inline-flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-slate-400" />
              {r.local}
            </span>
          )}
        </div>

        {/* Link online */}
        {r.modalidade === "ONLINE" && r.link_online && (
          <a
            href={r.link_online}
            target="_blank"
            rel="noreferrer"
            className="ml-1.5 mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
          >
            <Link2 size={15} /> Entrar na reunião
            <ArrowUpRight size={14} />
          </a>
        )}

        {/* Envolvidos (com e-mail, sem cortes) */}
        {parts.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3 pl-1.5">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Users size={13} /> Envolvidos · {parts.length}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {parts.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Avatar
                    nome={p.colaborador?.nome ?? "?"}
                    src={p.colaborador?.avatar_url}
                    size={30}
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="flex items-center gap-1 text-sm font-medium text-slate-700">
                      {p.colaborador?.nome ?? "?"}
                      {p.papel === "ORGANIZADOR" && (
                        <Crown size={12} className="shrink-0 text-amber-500" />
                      )}
                    </p>
                    {p.colaborador?.email && (
                      <p className="break-all text-xs text-slate-400">
                        {p.colaborador.email}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tema / resultado */}
        {(r.tema || r.resultado || r.proximos_passos) && (
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 pl-1.5 text-sm">
            {r.tema && (
              <p className="text-slate-600">
                <span className="font-medium text-slate-500">Tema: </span>
                {r.tema}
              </p>
            )}
            {r.resultado && (
              <p className="text-slate-600">
                <span className="font-medium text-slate-500">Resumo: </span>
                {r.resultado}
              </p>
            )}
            {r.proximos_passos && (
              <div className="text-slate-600">
                <span className="font-medium text-slate-500">
                  Próximos passos:
                </span>
                <ul className="mt-1 space-y-1">
                  {parseChecklist(r.proximos_passos).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className={
                          item.done
                            ? "text-emerald-600 line-through"
                            : "text-slate-400"
                        }
                      >
                        {item.done ? "☑" : "☐"}
                      </span>
                      <span className={item.done ? "line-through" : ""}>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 pl-1.5">
          {r.status === "CANCELADA" && r.motivo_cancelamento ? (
            <span className="truncate text-xs text-red-500">
              Cancelada: {r.motivo_cancelamento}
            </span>
          ) : (
            <span />
          )}
          <Acoes r={r} />
        </div>
      </article>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Reuniões externas
          </h1>
          <p className="text-sm text-slate-500">
            Captação, fidelização, gestão e relacionamento
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nova reunião</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Totalizador label="Total" value={totais.total} tone="slate" />
        {Object.entries(TIPO_REUNIAO).map(([k, label]) => (
          <Totalizador
            key={k}
            label={label}
            value={totais[k] ?? 0}
            tone={
              k === "CAPTACAO"
                ? "blue"
                : k === "FIDELIZACAO"
                  ? "green"
                  : k === "RELACIONAMENTO_INSTITUCIONAL"
                    ? "amber"
                    : "slate"
            }
          />
        ))}
        <Totalizador label="Realizadas" value={totais.REALIZADA} tone="green" />
        <Totalizador label="Canceladas" value={totais.CANCELADA} tone="red" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, cliente, pessoa..."
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <SelectMenu
          value={fTipo}
          onChange={setFTipo}
          emptyOption="Todos os tipos"
          placeholder="Todos os tipos"
          options={tipoReuniaoOptions(false)}
          className="sm:w-56"
        />
        <SelectMenu
          value={fStatus}
          onChange={setFStatus}
          emptyOption="Todos os status"
          placeholder="Todos os status"
          options={Object.entries(STATUS_REUNIAO).map(([v, l]) => ({
            value: v,
            label: l,
          }))}
          className="sm:w-44"
        />
      </div>

      {/* Grid de cards */}
      {filtradas.length === 0 ? (
        reunioes.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Nenhuma reunião registrada ainda"
            description="Registre a primeira reunião externa ou categorize eventos do calendário."
            actionLabel="Nova reunião"
            onAction={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : (
          <EmptyState
            title="Nenhuma reunião corresponde aos filtros"
            description="Ajuste o tipo ou o status para ver mais resultados."
            actionLabel="Limpar filtros"
            onAction={() => {
              setFTipo("");
              setFStatus("");
              setBusca("");
            }}
          />
        )
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.label}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                {g.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {g.items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {g.items.map((r) => (
                  <ReuniaoCard key={r.id} r={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ReuniaoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => router.refresh()}
        reuniao={editing}
        prefill={
          !editing && prefillCliente
            ? { cliente_id: prefillCliente.ci, cliente: prefillCliente }
            : undefined
        }
        colaboradores={colaboradores}
        fellowAtivo={fellowAtivo}
      />
    </div>
  );
}

const toneClasses: Record<string, string> = {
  slate: "text-slate-800",
  blue: "text-brand-700",
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
};

function Totalizador({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

