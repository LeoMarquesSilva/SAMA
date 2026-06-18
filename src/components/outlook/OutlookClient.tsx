"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  EyeOff,
  Video,
  MapPin,
  Building2,
  Users,
  Undo2,
  ChevronDown,
  Crown,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar, PersonTag, AvatarGroup } from "@/components/ui/Avatar";
import { formatDateTime, formatDuration } from "@/lib/format";
import { limparCorpoOutlook } from "@/lib/outlook";
import { ReuniaoForm } from "@/components/reunioes/ReuniaoForm";
import { AtividadeForm } from "@/components/atividades/AtividadeForm";
import {
  sincronizarOutlook,
  ignorarEvento,
  reverterEvento,
  vincularCategorizado,
} from "@/app/(app)/calendario/actions";
import type {
  OutlookEventoComPessoa,
  ReuniaoComRelacoes,
  AtividadeInterna,
  AtividadeComPessoa,
} from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import {
  type CalendarioItem,
  type CalendarioTipoFiltro,
  isOutlookPendente,
  itemMatchesTipo,
  colaboradorIdsDeEnvolvidos,
  emailsEnvolvidosOutlook,
  reuniaoGrupoVisivelParaUsuario,
  itemGrupoVisivelParaUsuario,
  itemTemGrupoCalendario,
  countPendentesNoItem,
  statusCalendarioParaUsuario,
} from "@/lib/calendario-items";
import {
  itemNoPeriodoDashboard,
  parseCalendarioFiltroInicial,
  parseDashboardDayKey,
  type CalendarioFiltroInicial,
  type DashboardPeriodo,
} from "@/lib/dashboard-filtros";
import { TIPO_ATIVIDADE_INTERNA, TIPO_REUNIAO, STATUS_REUNIAO } from "@/lib/constants";
import {
  buscarNoMapaPorEmail,
  emailExisteNoMapa,
  emailsEscritorioIguais,
  normalizeEscritorioEmail,
  registrarEmailNoMapa,
} from "@/lib/email-escritorio";
import {
  type CalendarioViewMode,
} from "@/components/calendario/CalendarioViewToggle";
import { CalendarioToolbar } from "@/components/calendario/CalendarioToolbar";
import { CalendarioMobileView } from "@/components/calendario/CalendarioMobileView";
import { CalendarioEventSheet } from "@/components/calendario/CalendarioEventSheet";

type PessoaOpt = {
  id: string;
  nome: string;
  email: string;
  avatar_url?: string | null;
};

const statusInfo: Record<string, { label: string; tone: "gray" | "green" | "blue" | "amber" | "purple" }> = {
  PENDENTE: { label: "Não categorizado", tone: "amber" },
  CATEGORIZADO_REUNIAO: { label: "Reunião", tone: "green" },
  CATEGORIZADO_ATIVIDADE: { label: "Atividade", tone: "purple" },
  IGNORADO: { label: "Ignorado", tone: "gray" },
};

function estadoInicialFiltro(f: CalendarioFiltroInicial) {
  const periodo = (["dia", "mes", "3m", "6m", "ano"].includes(f.p)
    ? f.p
    : "") as DashboardPeriodo | "";
  const fTipo: CalendarioTipoFiltro =
    f.kind === "atividade"
      ? "ATIVIDADES"
      : f.kind === "reuniao"
        ? "REUNIOES"
        : "TODOS";

  return {
    fStatus: "TODOS" as const,
    fTipo,
    fPessoa: f.pessoa,
    fKind: f.kind === "reuniao" || f.kind === "atividade" ? f.kind : "",
    fTipoDetalhe: f.tipo,
    fStatusDetalhe: f.status === "REALIZADA" ? f.status : "",
    fPeriodo: periodo,
    fDataDia: f.data,
    viewMode: f.view === "lista" ? ("lista" as const) : ("calendario" as const),
  };
}

export function OutlookClient({
  items,
  outlookVinculos = [],
  pessoas,
  colaboradores,
  isAdmin,
  pessoaAtualId,
  fellowAtivo = false,
  filtroInicial,
}: {
  items: CalendarioItem[];
  outlookVinculos?: {
    reuniao_id: string;
    pessoa_id: string;
    status: CalendarioItem["status"];
  }[];
  pessoas: PessoaOpt[];
  colaboradores: ColaboradorOpt[];
  isAdmin: boolean;
  pessoaAtualId: string | null;
  fellowAtivo?: boolean;
  filtroInicial?: CalendarioFiltroInicial;
}) {
  const router = useRouter();
  const inicial = useMemo(
    () => estadoInicialFiltro(filtroInicial ?? parseCalendarioFiltroInicial({})),
    [filtroInicial]
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>();
  const [fStatus, setFStatus] = useState<string>(inicial.fStatus);
  const [fTipo, setFTipo] = useState<CalendarioTipoFiltro>(inicial.fTipo);
  const [fPessoa, setFPessoa] = useState<string>(inicial.fPessoa);
  const [fKind, setFKind] = useState(inicial.fKind);
  const [fTipoDetalhe, setFTipoDetalhe] = useState(inicial.fTipoDetalhe);
  const [fStatusDetalhe, setFStatusDetalhe] = useState(inicial.fStatusDetalhe);
  const [fPeriodo, setFPeriodo] = useState(inicial.fPeriodo);
  const [fDataDia, setFDataDia] = useState(inicial.fDataDia);
  const [reuniaoEvento, setReuniaoEvento] =
    useState<CalendarioItem | null>(null);
  const [atividadeEvento, setAtividadeEvento] =
    useState<CalendarioItem | null>(null);
  const [editReuniao, setEditReuniao] = useState<ReuniaoComRelacoes | null>(null);
  const [editAtividade, setEditAtividade] = useState<AtividadeComPessoa | null>(null);
  const [viewMode, setViewMode] = useState<CalendarioViewMode>(inicial.viewMode);
  const [sheetEvento, setSheetEvento] =
    useState<CalendarioItem | null>(null);
  const [grupoReuniaoItem, setGrupoReuniaoItem] =
    useState<CalendarioItem | null>(null);

  // Avatar real para participantes internos (casado por e-mail).
  const avatarPorEmail = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of colaboradores) {
      registrarEmailNoMapa(m, c.email, c.avatar_url ?? null);
    }
    for (const p of pessoas) {
      if (!buscarNoMapaPorEmail(m, p.email)) {
        registrarEmailNoMapa(m, p.email, p.avatar_url ?? null);
      }
    }
    return m;
  }, [colaboradores, pessoas]);

  // Pessoas que de fato têm eventos importados (para o seletor).
  const pessoasComEventos = useMemo(() => {
    const ids = new Set(items.map((e) => e.pessoa_id).filter(Boolean));
    return pessoas.filter((p) => ids.has(p.id));
  }, [items, pessoas]);

  const donoPorReuniao = useMemo(() => {
    const map = new Map<
      string,
      { pessoa_id: string; pessoa: PessoaOpt | null }
    >();
    for (const e of items) {
      if (e.itemKind === "reuniao" && e.reuniao && e.pessoa_id) {
        map.set(e.reuniao.id, {
          pessoa_id: e.pessoa_id,
          pessoa: e.pessoa
            ? {
                id: e.pessoa.id,
                nome: e.pessoa.nome,
                email: e.pessoa.email ?? "",
                avatar_url: e.pessoa.avatar_url,
              }
            : null,
        });
      }
    }
    return map;
  }, [items]);

  const filtradoBase = useMemo(() => {
    return items.filter((e) => {
      if (fPeriodo) {
        if (
          !itemNoPeriodoDashboard(
            e.inicio,
            fPeriodo as DashboardPeriodo,
            fDataDia || parseDashboardDayKey()
          )
        ) {
          return false;
        }
      }

      if (fStatusDetalhe === "PENDENTE" && !isOutlookPendente(e)) return false;

      if (fStatusDetalhe === "REALIZADA") {
        if (e.itemKind === "outlook") return false;
        if (e.itemKind === "reuniao" && e.reuniao?.status !== "REALIZADA") {
          return false;
        }
        if (e.itemKind === "atividade" && e.atividade?.status !== "REALIZADA") {
          return false;
        }
      }

      if (fKind === "reuniao" && e.itemKind !== "reuniao") return false;
      if (fKind === "atividade" && e.itemKind !== "atividade") return false;

      if (fTipoDetalhe) {
        if (e.itemKind === "reuniao" && e.reuniao?.tipo !== fTipoDetalhe) {
          return false;
        }
        if (e.itemKind === "atividade" && e.atividade?.tipo !== fTipoDetalhe) {
          return false;
        }
        if (e.itemKind === "outlook") return false;
      }

      if (!itemMatchesTipo(e, fTipo)) return false;
      if (isAdmin && fPessoa) {
        if (itemTemGrupoCalendario(e)) {
          if (!itemGrupoVisivelParaUsuario(e, fPessoa, outlookVinculos)) {
            return false;
          }
        } else if (e.itemKind === "reuniao" && e.reuniao) {
          if (!reuniaoGrupoVisivelParaUsuario(e, fPessoa, outlookVinculos)) {
            return false;
          }
        } else if (e.itemKind === "atividade") {
          if (e.atividade?.pessoa_id !== fPessoa) return false;
        } else if (e.pessoa_id !== fPessoa) {
          return false;
        }
      }
      return true;
    });
  }, [
    items,
    fPeriodo,
    fDataDia,
    fStatusDetalhe,
    fKind,
    fTipoDetalhe,
    fTipo,
    fPessoa,
    isAdmin,
    donoPorReuniao,
    outlookVinculos,
  ]);

  const lista = useMemo(() => {
    const base =
      fStatus === "PENDENTE"
        ? filtradoBase.filter(isOutlookPendente)
        : filtradoBase;
    return [...base].sort((a, b) => {
      const ta = a.inicio ? new Date(a.inicio).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.inicio ? new Date(b.inicio).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [filtradoBase, fStatus]);

  const counts = useMemo(() => {
    let pendentes = 0;
    for (const e of filtradoBase) {
      pendentes += countPendentesNoItem(e);
    }
    return {
      PENDENTE: pendentes,
      TODOS: filtradoBase.length,
    };
  }, [filtradoBase]);

  const tipoCounts = useMemo(() => {
    let reunioes = 0;
    let atividades = 0;
    for (const e of filtradoBase) {
      if (e.itemKind === "reuniao" || e.itemKind === "outlook") reunioes++;
      if (e.itemKind === "atividade") atividades++;
    }
    return {
      TODOS: filtradoBase.length,
      REUNIOES: reunioes,
      ATIVIDADES: atividades,
    };
  }, [filtradoBase]);

  const pendentes = useMemo(
    () => items.reduce((n, e) => n + countPendentesNoItem(e), 0),
    [items]
  );
  const filtrosAtivos = Boolean(
    fPessoa ||
      fTipo !== "TODOS" ||
      fKind ||
      fTipoDetalhe ||
      fStatusDetalhe ||
      fPeriodo
  );

  function onSelectItem(item: CalendarioItem) {
    if (itemTemGrupoCalendario(item)) {
      setGrupoReuniaoItem(item);
      return;
    }

    if (item.grupoOutlook?.length === 1) {
      setSheetEvento(item.grupoOutlook[0].item);
      return;
    }
    if (item.grupoReunioes?.length === 1) {
      setEditReuniao(item.grupoReunioes[0].reuniao);
      return;
    }

    if (item.itemKind === "reuniao" && item.reuniao) {
      setEditReuniao(item.reuniao);
      return;
    }
    if (item.itemKind === "atividade" && item.atividade) {
      setEditAtividade(item.atividade);
      return;
    }
    setSheetEvento(item);
  }

  function sincronizar(escopo: "eu" | "todos") {
    setMsg(undefined);
    startTransition(async () => {
      const r = await sincronizarOutlook(escopo);
      if (!r.ok) {
        setMsg(r.error ?? "Erro na sincronização.");
      } else {
        setMsg(
          `Sincronizado: ${r.importados} evento(s) · ${r.pessoasOk} ok` +
            (r.pessoasErro ? ` · ${r.pessoasErro} com erro` : "") +
            (r.detalhes && r.detalhes.length
              ? ` — ${r.detalhes.slice(0, 2).join("; ")}`
              : "")
        );
      }
      router.refresh();
    });
  }

  function ignorar(id: string) {
    startTransition(async () => {
      await ignorarEvento(id);
      router.refresh();
    });
  }
  function reverter(id: string) {
    startTransition(async () => {
      await reverterEvento(id);
      router.refresh();
    });
  }

  // Pré-preenchimento dos formulários a partir do evento.
  function prefillReuniao(
    e: CalendarioItem
  ): Partial<ReuniaoComRelacoes> & { dono_calendario_id?: string } {
    const ids = colaboradorIdsDeEnvolvidos(colaboradores, e);
    const matchIds = ids.map((id) => ({
      colaborador_id: id,
      papel: "PARTICIPANTE" as const,
    }));
    // Convidados do invite que NÃO são da equipe interna → participantes externos.
    const externos = emailsEnvolvidosOutlook(e)
      .filter(
        (a) => !colaboradores.some((c) => emailsEscritorioIguais(c.email, a.email))
      )
      .map((a) => ({
        colaborador_id: null,
        papel: "PARTICIPANTE" as const,
        nome: a.nome,
        email: a.email,
      }));
    const passada =
      e.inicio && new Date(e.inicio).getTime() < Date.now();
    return {
      titulo: e.titulo ?? "",
      outlook_event_id: e.outlook_event_id,
      dono_calendario_id: e.pessoa_id,
      data_hora_inicio: e.inicio ?? "",
      data_hora_fim: e.fim,
      duracao_minutos: e.duracao_minutos,
      modalidade: e.online
        ? "ONLINE"
        : e.local
          ? "PRESENCIAL_EXTERNO"
          : "PRESENCIAL_ESCRITORIO",
      status: passada ? "REALIZADA" : "AGENDADA",
      link_online: e.link_online,
      local: e.local,
      participantes: [
        ...matchIds,
        ...externos,
      ] as ReuniaoComRelacoes["participantes"],
    };
  }
  function prefillAtividade(e: CalendarioItem): Partial<AtividadeInterna> {
    return {
      titulo: e.titulo ?? "",
      data_hora_inicio: e.inicio ?? "",
      data_hora_fim: e.fim,
      duracao_minutos: e.duracao_minutos,
      descricao: limparCorpoOutlook(e.corpo_preview),
      pessoa_id: e.pessoa_id,
    };
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
          Calendário
        </h1>
        <p className="text-sm text-slate-500">
          {pendentes} não categorizado(s) · reuniões e atividades no calendário
        </p>
      </div>

      {msg && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {msg}
        </p>
      )}

      <CalendarioToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        pending={pending}
        isAdmin={isAdmin}
        onAtualizar={() => sincronizar("eu")}
        onSincronizarTodos={() => sincronizar("todos")}
        fStatus={fStatus as "TODOS" | "PENDENTE"}
        onFStatusChange={setFStatus}
        statusCounts={counts}
        fTipo={fTipo}
        onFTipoChange={setFTipo}
        tipoCounts={tipoCounts}
        pessoas={pessoasComEventos}
        fPessoa={fPessoa}
        onFPessoaChange={setFPessoa}
        filtrosAtivos={filtrosAtivos}
        onLimparFiltros={() => {
          setFPessoa("");
          setFTipo("TODOS");
          setFStatus("TODOS");
          setFKind("");
          setFTipoDetalhe("");
          setFStatusDetalhe("");
          setFPeriodo("");
          setFDataDia("");
        }}
      />

      {viewMode === "calendario" ? (
        <>
          {lista.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              {items.length === 0
                ? "Nenhum item no calendário. Sincronize o Outlook ou registre uma atividade."
                : "Nenhum item corresponde aos filtros."}
            </p>
          ) : (
            <CalendarioMobileView
              eventos={lista}
              onSelectEvento={onSelectItem}
              pessoaAtualId={pessoaAtualId}
            />
          )}

          <CalendarioEventSheet
            evento={sheetEvento}
            onClose={() => setSheetEvento(null)}
          >
            {sheetEvento && sheetEvento.itemKind === "outlook" && (
              <EventoCard
                e={sheetEvento}
                isAdmin={isAdmin}
                pending={pending}
                avatarPorEmail={avatarPorEmail}
                pessoaAtualId={pessoaAtualId}
                onReuniao={() => {
                  setReuniaoEvento(sheetEvento);
                  setSheetEvento(null);
                }}
                onAtividade={() => {
                  setAtividadeEvento(sheetEvento);
                  setSheetEvento(null);
                }}
                onIgnorar={() => {
                  ignorar(sheetEvento.sourceId);
                  setSheetEvento(null);
                }}
                onReverter={() => {
                  reverter(sheetEvento.sourceId);
                  setSheetEvento(null);
                }}
                compact
              />
            )}
          </CalendarioEventSheet>
        </>
      ) : (
        <div className="space-y-3">
          {lista.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
              {items.length === 0
                ? "Nenhum item no calendário."
                : "Nenhum item corresponde aos filtros."}
            </p>
          )}

          {lista.map((e) =>
            e.itemKind === "outlook" ? (
              <EventoCard
                key={e.id}
                e={e}
                isAdmin={isAdmin}
                pending={pending}
                avatarPorEmail={avatarPorEmail}
                pessoaAtualId={pessoaAtualId}
                onReuniao={() =>
                  itemTemGrupoCalendario(e) ? onSelectItem(e) : setReuniaoEvento(e)
                }
                onAtividade={() =>
                  itemTemGrupoCalendario(e) ? onSelectItem(e) : setAtividadeEvento(e)
                }
                onIgnorar={() => ignorar(e.sourceId)}
                onReverter={() => reverter(e.sourceId)}
              />
            ) : (
              <RegistroCard
                key={e.id}
                item={e}
                isAdmin={isAdmin}
                onEditar={() => onSelectItem(e)}
              />
            )
          )}
        </div>
      )}

      {/* Form de reunião pré-preenchido */}
      {reuniaoEvento && (
        <ReuniaoForm
          open={true}
          onClose={() => setReuniaoEvento(null)}
          onSaved={() => router.refresh()}
          prefill={prefillReuniao(reuniaoEvento)}
          afterCreate={async (id) => {
            const v = await vincularCategorizado(
              reuniaoEvento.sourceId,
              "REUNIAO",
              id
            );
            if (!v.ok) {
              throw new Error(v.error ?? "Erro ao vincular evento.");
            }
            setFStatus("TODOS");
          }}
          colaboradores={colaboradores}
          usuarios={pessoas}
          fellowAtivo={fellowAtivo}
        />
      )}

      {/* Form de atividade pré-preenchido */}
      {atividadeEvento && (
        <AtividadeForm
          open={true}
          onClose={() => setAtividadeEvento(null)}
          onSaved={() => router.refresh()}
          prefill={prefillAtividade(atividadeEvento)}
          afterCreate={async (id) => {
            const v = await vincularCategorizado(
              atividadeEvento.sourceId,
              "ATIVIDADE",
              id
            );
            if (!v.ok) {
              throw new Error(v.error ?? "Erro ao vincular evento.");
            }
            setFStatus("TODOS");
          }}
          pessoas={pessoas}
          podeEscolherPessoa={isAdmin}
          pessoaAtualId={pessoaAtualId}
        />
      )}

      {editReuniao && (
        <ReuniaoForm
          open={true}
          onClose={() => setEditReuniao(null)}
          onSaved={() => router.refresh()}
          reuniao={editReuniao}
          colaboradores={colaboradores}
          usuarios={pessoas}
          fellowAtivo={fellowAtivo}
        />
      )}

      {editAtividade && (
        <AtividadeForm
          open={true}
          onClose={() => setEditAtividade(null)}
          onSaved={() => router.refresh()}
          atividade={editAtividade}
          pessoas={pessoas}
          podeEscolherPessoa={isAdmin}
          pessoaAtualId={pessoaAtualId}
        />
      )}

      <CalendarioEventSheet
        evento={grupoReuniaoItem}
        onClose={() => setGrupoReuniaoItem(null)}
      >
        {grupoReuniaoItem && itemTemGrupoCalendario(grupoReuniaoItem) && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Este evento aparece no calendário de cada sócio separadamente.
              Escolha de quem deseja abrir:
            </p>
            <ul className="space-y-2">
              {grupoReuniaoItem.grupoOutlook?.map((g) => (
                <li key={g.item.sourceId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetEvento(g.item);
                      setGrupoReuniaoItem(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Avatar
                      nome={g.pessoa?.nome ?? "Sócio"}
                      src={g.pessoa?.avatar_url}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {g.pessoa?.nome ?? "Sem sócio vinculado"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {statusInfo[g.item.status]?.label ?? g.item.status}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
              {grupoReuniaoItem.grupoReunioes?.map((g) => (
                <li key={g.reuniao.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditReuniao(g.reuniao);
                      setGrupoReuniaoItem(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Avatar
                      nome={g.pessoa?.nome ?? "Sócio"}
                      src={g.pessoa?.avatar_url}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {g.pessoa?.nome ?? "Sem sócio vinculado"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {STATUS_REUNIAO[g.reuniao.status]}
                        {g.reuniao.tipo ? ` · ${TIPO_REUNIAO[g.reuniao.tipo]}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {(grupoReuniaoItem.grupoOutlook?.length ?? 0) +
              (grupoReuniaoItem.grupoReunioes?.length ?? 0) ===
              0 && (
              <p className="text-sm text-amber-700">
                Não foi possível listar os calendários individuais. Tente
                atualizar a página.
              </p>
            )}
          </div>
        )}
      </CalendarioEventSheet>
    </div>
  );
}

function RegistroCard({
  item,
  isAdmin,
  onEditar,
}: {
  item: CalendarioItem;
  isAdmin: boolean;
  onEditar: () => void;
}) {
  const isReuniao = item.itemKind === "reuniao";
  const label = isReuniao
    ? TIPO_REUNIAO[item.reuniao!.tipo]
    : TIPO_ATIVIDADE_INTERNA[item.atividade!.tipo];
  const statusLabel = isReuniao
    ? STATUS_REUNIAO[item.reuniao!.status]
    : item.atividade!.status === "REALIZADA"
      ? "Realizada"
      : "Cancelada";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-slate-800">{item.titulo}</h3>
        <Badge tone={isReuniao ? "green" : "purple"}>
          {isReuniao ? "Reunião" : "Atividade"}
        </Badge>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarClock size={13} /> {formatDateTime(item.inicio)}
          {item.duracao_minutos ? ` · ${formatDuration(item.duracao_minutos)}` : ""}
        </span>
        <span>{label}</span>
        <span>{statusLabel}</span>
        {isAdmin &&
          (item.grupoPessoas?.length ? (
            <AvatarGroup
              size={18}
              max={4}
              pessoas={item.grupoPessoas.map((p) => ({
                nome: p.nome,
                avatar_url: p.avatar_url,
              }))}
            />
          ) : item.pessoa?.nome ? (
            <PersonTag nome={item.pessoa.nome} src={item.pessoa.avatar_url} size={18} />
          ) : null)}
      </div>
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
        <Button size="sm" variant="secondary" onClick={onEditar}>
          Editar
        </Button>
      </div>
    </article>
  );
}

// ── Card de evento Outlook (pendente / ignorado) ──
function EventoCard({
  e,
  isAdmin,
  pending,
  avatarPorEmail,
  pessoaAtualId = null,
  onReuniao,
  onAtividade,
  onIgnorar,
  onReverter,
  compact = false,
}: {
  e: CalendarioItem;
  isAdmin: boolean;
  pending: boolean;
  avatarPorEmail: Map<string, string | null>;
  pessoaAtualId?: string | null;
  onReuniao: () => void;
  onAtividade: () => void;
  onIgnorar: () => void;
  onReverter: () => void;
  compact?: boolean;
}) {
  const [showEnvolvidos, setShowEnvolvidos] = useState(false);
  const [corpoExpandido, setCorpoExpandido] = useState(false);
  const status = statusCalendarioParaUsuario(e, pessoaAtualId);
  const s = statusInfo[status];
  const corpo = limparCorpoOutlook(e.corpo_preview);

  // Organizador + participantes + dono do calendário, sem duplicar por e-mail.
  const envolvidos = emailsEnvolvidosOutlook(e);

  function ModIcon() {
    if (e.online) return <Video size={13} />;
    if (e.local) return <MapPin size={13} />;
    return <Building2 size={13} />;
  }

  return (
    <article
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow",
        !compact && "hover:shadow-md"
      )}
    >
      {/* Cabeçalho */}
      {!compact && (
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug text-slate-800">
            {e.titulo}
          </h3>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
      )}
      {compact && (
        <div className="mb-2">
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
      )}

      {/* Metadados */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <CalendarClock size={13} /> {formatDateTime(e.inicio)}
          {e.duracao_minutos ? ` · ${formatDuration(e.duracao_minutos)}` : ""}
        </span>
        <span className="inline-flex items-center gap-1">
          <ModIcon />
          {e.online ? "Online" : e.local ? e.local : "Presencial"}
        </span>
        {isAdmin &&
          (e.grupoPessoas?.length ? (
            <AvatarGroup
              size={18}
              max={4}
              pessoas={e.grupoPessoas.map((p) => ({
                nome: p.nome,
                avatar_url: p.avatar_url,
              }))}
            />
          ) : e.pessoa?.nome ? (
            <PersonTag nome={e.pessoa.nome} src={e.pessoa.avatar_url} size={18} />
          ) : null)}
      </div>

      {/* Descrição limpa (expande no clique) */}
      {corpo && (
        <button
          type="button"
          onClick={() => setCorpoExpandido((v) => !v)}
          className={clsx(
            "mt-2 block w-full whitespace-pre-line text-left text-xs text-slate-500",
            !corpoExpandido && "line-clamp-2"
          )}
          title={corpoExpandido ? "Recolher" : "Ver descrição completa"}
        >
          {corpo}
        </button>
      )}

      {/* Envolvidos */}
      {envolvidos.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => setShowEnvolvidos((v) => !v)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={showEnvolvidos}
          >
            <Users size={14} className="shrink-0 text-slate-400" />
            <AvatarGroup
              size={22}
              max={6}
              pessoas={envolvidos.map((p) => ({
                nome: p.nome,
                avatar_url: buscarNoMapaPorEmail(avatarPorEmail, p.email) ?? null,
              }))}
            />
            <span className="text-xs font-medium text-slate-500">
              {envolvidos.length} envolvido(s)
            </span>
            <ChevronDown
              size={15}
              className={clsx(
                "ml-auto shrink-0 text-slate-400 transition-transform",
                showEnvolvidos && "rotate-180"
              )}
            />
          </button>

          {showEnvolvidos && (
            <ul className="mt-2 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
              {envolvidos.map((p) => {
                const avatar = buscarNoMapaPorEmail(avatarPorEmail, p.email) ?? null;
                const interno = emailExisteNoMapa(avatarPorEmail, p.email);
                return (
                  <li
                    key={normalizeEscritorioEmail(p.email)}
                    className="flex items-start gap-2"
                  >
                    <Avatar nome={p.nome} src={avatar} size={30} />
                    <div className="min-w-0 leading-tight">
                      <p className="flex items-center gap-1 text-sm font-medium text-slate-700">
                        <span className="truncate">{p.nome}</span>
                        {p.organizador && (
                          <Crown
                            size={12}
                            className="shrink-0 text-amber-500"
                            aria-label="Organizador"
                          />
                        )}
                        {interno && (
                          <span className="shrink-0 rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold text-brand-700">
                            interno
                          </span>
                        )}
                      </p>
                      <p className="break-all text-xs text-slate-400">
                        {p.email}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Ações */}
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
            <Undo2 size={15} /> Voltar para não categorizado
          </Button>
        </div>
      )}
    </article>
  );
}
