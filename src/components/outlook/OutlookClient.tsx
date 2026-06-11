"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  CalendarClock,
  ClipboardList,
  EyeOff,
  Video,
  MapPin,
  Building2,
  Users,
  Undo2,
  Search,
  X,
  ChevronDown,
  Crown,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar, PersonTag, AvatarGroup } from "@/components/ui/Avatar";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { SelectMenu } from "@/components/ui/SelectMenu";
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
} from "@/types/database";
import type { ColaboradorOpt } from "@/lib/colaboradores";

type PessoaOpt = {
  id: string;
  nome: string;
  email: string;
  avatar_url?: string | null;
};

const statusInfo: Record<string, { label: string; tone: "gray" | "green" | "blue" | "amber" }> = {
  PENDENTE: { label: "Pendente", tone: "amber" },
  CATEGORIZADO_REUNIAO: { label: "Virou reunião", tone: "green" },
  CATEGORIZADO_ATIVIDADE: { label: "Virou atividade", tone: "blue" },
  IGNORADO: { label: "Ignorado", tone: "gray" },
};

export function OutlookClient({
  eventos,
  pessoas,
  colaboradores,
  isAdmin,
  pessoaAtualId,
}: {
  eventos: OutlookEventoComPessoa[];
  pessoas: PessoaOpt[];
  colaboradores: ColaboradorOpt[];
  isAdmin: boolean;
  pessoaAtualId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>();
  const [fStatus, setFStatus] = useState<string>("PENDENTE");
  const [fPessoa, setFPessoa] = useState<string>("");
  const [fModalidade, setFModalidade] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [reuniaoEvento, setReuniaoEvento] =
    useState<OutlookEventoComPessoa | null>(null);
  const [atividadeEvento, setAtividadeEvento] =
    useState<OutlookEventoComPessoa | null>(null);

  // Avatar real para participantes internos (casado por e-mail).
  const avatarPorEmail = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of colaboradores) {
      m.set(c.email.toLowerCase(), c.avatar_url ?? null);
    }
    for (const p of pessoas) {
      const k = p.email.toLowerCase();
      if (!m.has(k)) m.set(k, p.avatar_url ?? null);
    }
    return m;
  }, [colaboradores, pessoas]);

  // Pessoas que de fato têm eventos importados (para o seletor).
  const pessoasComEventos = useMemo(() => {
    const ids = new Set(eventos.map((e) => e.pessoa_id));
    return pessoas.filter((p) => ids.has(p.id));
  }, [eventos, pessoas]);

  // Aplica todos os filtros, exceto status (para contar por status).
  const filtradoSemStatus = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return eventos.filter((e) => {
      if (isAdmin && fPessoa && e.pessoa_id !== fPessoa) return false;
      if (fModalidade === "ONLINE" && !e.online) return false;
      if (fModalidade === "PRESENCIAL" && e.online) return false;
      if (q) {
        const hay = [
          e.titulo,
          e.organizador_nome,
          e.organizador_email,
          e.local,
          e.corpo_preview,
          ...(e.participantes ?? []).flatMap((p) => [p.nome, p.email]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eventos, fPessoa, fModalidade, busca, isAdmin]);

  const lista = useMemo(
    () =>
      fStatus === "TODOS"
        ? filtradoSemStatus
        : filtradoSemStatus.filter((e) => e.status === fStatus),
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
    for (const e of filtradoSemStatus) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [filtradoSemStatus]);

  const pendentes = eventos.filter((e) => e.status === "PENDENTE").length;
  const filtrosAtivos = Boolean(fPessoa || fModalidade || busca);

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
  function prefillReuniao(e: OutlookEventoComPessoa): Partial<ReuniaoComRelacoes> {
    const matchIds = colaboradores
      .filter((c) =>
        (e.participantes ?? []).some(
          (a) => a.email?.toLowerCase() === c.email.toLowerCase()
        )
      )
      .map((c) => ({ colaborador_id: c.id, papel: "PARTICIPANTE" }));
    return {
      titulo: e.titulo ?? "",
      data_hora_inicio: e.inicio ?? "",
      data_hora_fim: e.fim,
      duracao_minutos: e.duracao_minutos,
      modalidade: e.online
        ? "ONLINE"
        : e.local
          ? "PRESENCIAL_EXTERNO"
          : "PRESENCIAL_ESCRITORIO",
      link_online: e.link_online,
      local: e.local,
      tema: limparCorpoOutlook(e.corpo_preview),
      participantes: matchIds as ReuniaoComRelacoes["participantes"],
    };
  }
  function prefillAtividade(e: OutlookEventoComPessoa): Partial<AtividadeInterna> {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">
            Calendário
          </h1>
          <p className="text-sm text-slate-500">
            {pendentes} evento(s) pendente(s) de categorização
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => sincronizar("eu")}
          >
            <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
            Atualizar calendário
          </Button>
          {isAdmin && (
            <Button disabled={pending} onClick={() => sincronizar("todos")}>
              <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
              Sincronizar todos
            </Button>
          )}
        </div>
      </div>

      {msg && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {msg}
        </p>
      )}

      {/* Pills de status com contagem */}
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
            onClick={() => setFStatus(f.key)}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition " +
              (fStatus === f.key
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
            }
          >
            {f.label}
            <span
              className={
                "rounded-full px-1.5 text-[11px] font-semibold " +
                (fStatus === f.key
                  ? "bg-white/25 text-white"
                  : "bg-slate-100 text-slate-500")
              }
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Busca + selects */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título, pessoa ou e-mail…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
          />
        </div>

        {isAdmin && (
          <PersonSelect
            pessoas={pessoasComEventos}
            value={fPessoa}
            onChange={setFPessoa}
            placeholder="Todas as pessoas"
            emptyLabel="Todas as pessoas"
            className="min-w-[200px]"
          />
        )}

        <SelectMenu
          value={fModalidade}
          onChange={setFModalidade}
          emptyOption="Todas as modalidades"
          placeholder="Todas as modalidades"
          options={[
            { value: "ONLINE", label: "Online" },
            { value: "PRESENCIAL", label: "Presencial" },
          ]}
          className="sm:w-52"
        />

        {filtrosAtivos && (
          <button
            onClick={() => {
              setBusca("");
              setFPessoa("");
              setFModalidade("");
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      <div className="space-y-3">
        {lista.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            {eventos.length === 0
              ? "Nenhum evento importado. O calendário é atualizado automaticamente ao entrar — ou clique em “Atualizar calendário”."
              : "Nenhum evento corresponde aos filtros."}
          </p>
        )}

        {lista.map((e) => (
          <EventoCard
            key={e.id}
            e={e}
            isAdmin={isAdmin}
            pending={pending}
            avatarPorEmail={avatarPorEmail}
            onReuniao={() => setReuniaoEvento(e)}
            onAtividade={() => setAtividadeEvento(e)}
            onIgnorar={() => ignorar(e.id)}
            onReverter={() => reverter(e.id)}
          />
        ))}
      </div>

      {/* Form de reunião pré-preenchido */}
      {reuniaoEvento && (
        <ReuniaoForm
          open={true}
          onClose={() => setReuniaoEvento(null)}
          onSaved={() => router.refresh()}
          prefill={prefillReuniao(reuniaoEvento)}
          afterCreate={async (id) => {
            await vincularCategorizado(reuniaoEvento.id, "REUNIAO", id);
          }}
          colaboradores={colaboradores}
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
            await vincularCategorizado(atividadeEvento.id, "ATIVIDADE", id);
          }}
          pessoas={pessoas}
          podeEscolherPessoa={isAdmin}
          pessoaAtualId={pessoaAtualId}
        />
      )}
    </div>
  );
}

// ── Card de evento com descrição limpa e envolvidos expansíveis ──
function EventoCard({
  e,
  isAdmin,
  pending,
  avatarPorEmail,
  onReuniao,
  onAtividade,
  onIgnorar,
  onReverter,
}: {
  e: OutlookEventoComPessoa;
  isAdmin: boolean;
  pending: boolean;
  avatarPorEmail: Map<string, string | null>;
  onReuniao: () => void;
  onAtividade: () => void;
  onIgnorar: () => void;
  onReverter: () => void;
}) {
  const [showEnvolvidos, setShowEnvolvidos] = useState(false);
  const [corpoExpandido, setCorpoExpandido] = useState(false);
  const s = statusInfo[e.status];
  const corpo = limparCorpoOutlook(e.corpo_preview);

  // Organizador + participantes, sem duplicar por e-mail.
  const porEmail = new Map<
    string,
    { nome: string; email: string; organizador: boolean }
  >();
  if (e.organizador_email) {
    porEmail.set(e.organizador_email.toLowerCase(), {
      nome: e.organizador_nome || e.organizador_email,
      email: e.organizador_email,
      organizador: true,
    });
  }
  for (const p of e.participantes ?? []) {
    const key = p.email?.toLowerCase();
    if (key && !porEmail.has(key)) {
      porEmail.set(key, {
        nome: p.nome || p.email,
        email: p.email,
        organizador: false,
      });
    }
  }
  const envolvidos = [...porEmail.values()];

  function ModIcon() {
    if (e.online) return <Video size={13} />;
    if (e.local) return <MapPin size={13} />;
    return <Building2 size={13} />;
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-slate-800">
          {e.titulo}
        </h3>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>

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
        {isAdmin && e.pessoa?.nome && (
          <PersonTag nome={e.pessoa.nome} src={e.pessoa.avatar_url} size={18} />
        )}
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
                avatar_url: avatarPorEmail.get(p.email.toLowerCase()),
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
                const avatar = avatarPorEmail.get(p.email.toLowerCase());
                const interno = avatarPorEmail.has(p.email.toLowerCase());
                return (
                  <li key={p.email} className="flex items-start gap-2">
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
      {e.status === "PENDENTE" ? (
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
    </article>
  );
}
