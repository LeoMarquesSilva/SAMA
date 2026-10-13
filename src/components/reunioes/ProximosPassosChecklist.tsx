"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  colaboradorPorNome,
  recomporPassoComMarcador,
  separarPessoaDoPasso,
  ResponsaveisSugeridos,
} from "@/components/reunioes/PassoResponsavel";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { DateBrInput } from "@/components/ui/DateBrInput";
import {
  parseChecklist,
  rotuloEnviadoAgendamento,
  serializeChecklist,
  type ChecklistItem,
} from "@/lib/proximos-passos-checklist";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { ehCompromissoDeReuniao } from "@/lib/vios-agendamento";
import {
  alterarDataAgendamentoVios,
  type AgendamentoViosStatus,
} from "@/lib/vios-status-actions";

const VIOS_TAREFA_URL = "https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&pxe_id=";

function chaveTexto(t: string | null | undefined): string {
  return String(t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function tomStatusTarefa(status: string): "green" | "amber" | "red" | "gray" {
  const s = status.trim().toLowerCase();
  if (s.startsWith("conclu")) return "green";
  if (s.startsWith("abert") || s.startsWith("pend")) return "amber";
  if (s.startsWith("cancel")) return "red";
  return "gray";
}

/** Status "Aberta" da tarefa no VIOS (único em que a data pode ser mudada pelo SAMA). */
function tarefaAberta(status: string | null | undefined): boolean {
  return (status ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase() === "aberta";
}

function brParaIso(br: string): string {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function isoParaBr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Situação da última mudança de data pedida ao VIOS depois da criação. */
function ProrrogacaoVios({ a }: { a: AgendamentoViosStatus }) {
  const p = a.prorrogacao;
  if (!p) return null;
  if (p.status === "erro") {
    return (
      <span className="inline-flex items-center gap-1 text-red-700" title={p.erro ?? undefined}>
        <AlertTriangle size={13} />
        Data não mudou no VIOS{p.erro ? `: ${p.erro.slice(0, 120)}` : ""}
      </span>
    );
  }
  if (p.status !== "concluido") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <Loader2 size={13} className="animate-spin" />
        Nova data indo para o VIOS…
      </span>
    );
  }
  return a.data !== a.data_original ? (
    <span className="text-emerald-700">Data alterada no VIOS (era {a.data_original})</span>
  ) : null;
}

/**
 * Data do agendamento. Num próximo passo enviado, dá para mudar aqui: o SAMA
 * pede sozinho ao robô para prorrogar a tarefa no VIOS.
 */
function DataVios({
  a,
  onAlterado,
}: {
  a: AgendamentoViosStatus;
  onAlterado?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [iso, setIso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  // Só depois de criada no VIOS (com CI), com a tarefa Aberta e sem outra
  // mudança de data a caminho. Na fila de envio, não.
  const prorrogando = a.prorrogacao != null && a.prorrogacao.status !== "concluido" && a.prorrogacao.status !== "erro";
  const podeMudar =
    Boolean(onAlterado) &&
    !ehCompromissoDeReuniao(a.tarefa) &&
    a.status === "concluido" &&
    Boolean(a.ci_vios) &&
    tarefaAberta(a.status_tarefa) &&
    !prorrogando;

  async function salvar() {
    const br = isoParaBr(iso);
    if (!br) return setErro("Informe a data.");
    setSalvando(true);
    setErro(undefined);
    const r = await alterarDataAgendamentoVios(a.id, br).catch(() => ({
      ok: false,
      error: "Falha de conexão.",
    }));
    setSalvando(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível mudar a data.");
    setEditando(false);
    onAlterado?.();
  }

  if (editando) {
    return (
      <span className="inline-flex flex-wrap items-end gap-2">
        <span className="w-40">
          <DateBrInput value={iso} onChange={setIso} />
        </span>
        <Button type="button" size="sm" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar data"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={salvando}
          onClick={() => setEditando(false)}
        >
          Cancelar
        </Button>
        {erro && <span className="text-red-700">{erro}</span>}
      </span>
    );
  }

  const data = (
    <>
      <CalendarDays size={13} className="text-slate-400" />
      {a.data}
    </>
  );
  return (
    <>
      {podeMudar ? (
        <button
          type="button"
          onClick={() => {
            setIso(brParaIso(a.data));
            setErro(undefined);
            setEditando(true);
          }}
          className="inline-flex items-center gap-1 rounded tabular-nums text-slate-600 hover:text-brand-700"
          title="Mudar a data: o robô prorroga a tarefa no VIOS"
        >
          {data}
          <Pencil size={12} className="text-slate-400" />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">{data}</span>
      )}
      <ProrrogacaoVios a={a} />
    </>
  );
}

function DetalheVios({
  a,
  colaboradores,
  onAlterado,
}: {
  a: AgendamentoViosStatus;
  colaboradores: ColaboradorOpt[];
  onAlterado?: () => void;
}) {
  const colab = colaboradorPorNome(a.responsavel, colaboradores);
  return (
    <>
      {a.tarefa && (
        <span className="inline-flex items-center gap-1 text-slate-600">
          <ListChecks size={13} className="text-slate-400" />
          {a.tarefa}
        </span>
      )}
      {a.responsavel && (
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <Avatar
            nome={colab?.nome ?? a.responsavel}
            src={colab?.avatar_url}
            size={18}
          />
          {colab?.nome ?? a.responsavel}
        </span>
      )}
      {a.data && <DataVios a={a} onAlterado={onAlterado} />}
    </>
  );
}

/** Situação no VIOS de um item de "Próximos passos" (último envio). */
export function StatusVios({
  a,
  colaboradores,
  onAlterado,
}: {
  a: AgendamentoViosStatus;
  colaboradores: ColaboradorOpt[];
  /** Com ele, a data de um passo enviado pode ser mudada (o robô prorroga no VIOS). */
  onAlterado?: () => void;
}) {
  const tom = a.status_tarefa ? tomStatusTarefa(a.status_tarefa) : "gray";
  const statusTarefa = a.ci_vios ? (
    a.status_tarefa ? (
      <span
        className={clsx(
          "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
          tom === "green" && "bg-emerald-100 text-emerald-800",
          tom === "amber" && "bg-amber-100 text-amber-800",
          tom === "red" && "bg-red-100 text-red-800",
          tom === "gray" && "bg-slate-100 text-slate-700"
        )}
      >
        {a.status_tarefa}
      </span>
    ) : (
      <span className="text-sm font-medium text-slate-400">Status não encontrado na base</span>
    )
  ) : null;
  const linkCi = a.ci_vios ? (
    <a
      href={`${VIOS_TAREFA_URL}${a.ci_vios}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir a tarefa no VIOS (nova aba)"
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
    >
      <span className="font-mono tabular-nums">CI {a.ci_vios}</span>
      <ExternalLink size={12} />
    </a>
  ) : null;
  if (a.status === "concluido") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        {statusTarefa}
        {linkCi}
        <DetalheVios a={a} colaboradores={colaboradores} onAlterado={onAlterado} />
        {!a.ci_vios && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle size={13} />
            CI não identificado — conferir na pasta {a.pasta}
          </span>
        )}
      </div>
    );
  }
  if (a.status === "erro") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
        <AlertTriangle size={14} className="mt-px shrink-0" />
        <span title={a.erro ?? undefined}>
          <span className="font-semibold">Erro no VIOS: </span>
          {(a.erro ?? "Falha no agendamento.").slice(0, 180)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <Loader2 size={13} className="animate-spin" />
        {a.status === "processando" ? "Enviando ao VIOS…" : "Na fila de envio…"}
      </span>
      <DetalheVios a={a} colaboradores={colaboradores} onAlterado={onAlterado} />
    </div>
  );
}

function initItems(value: string): ChecklistItem[] {
  const parsed = parseChecklist(value);
  return parsed.length > 0
    ? parsed
    : [{ text: "", done: false, colaborador_id: null, prazo: null }];
}

export function ProximosPassosChecklist({
  value,
  onChange,
  error,
  label = "Próximos passos",
  labelAdornment,
  rodape,
  required,
  colaboradores = [],
  simples = true,
  agendamentosVios = [],
  onAgendamentoAlterado,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  labelAdornment?: React.ReactNode;
  /** Ações que vêm depois do preenchimento (ex.: Enviar para Agendamento). */
  rodape?: React.ReactNode;
  required?: boolean;
  colaboradores?: ColaboradorOpt[];
  simples?: boolean;
  /** Situação na fila do VIOS dos itens já enviados (mais recente primeiro). */
  agendamentosVios?: AgendamentoViosStatus[];
  /** Data de um passo enviado mudou: recarregar a situação no VIOS. */
  onAgendamentoAlterado?: () => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(() => initItems(value));
  const [rascunhos, setRascunhos] = useState<Record<number, string>>({});
  const lastEmitted = useRef(value);
  const prazosVios = agendamentosVios.filter((a) => !ehCompromissoDeReuniao(a.tarefa));

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setItems(initItems(value));
      setRascunhos({});
    }
  }, [value]);

  function emitChange(next: ChecklistItem[]) {
    setItems(next);
    const serialized = serializeChecklist(next);
    lastEmitted.current = serialized;
    onChange(serialized);
  }

  function patchItem(index: number, patch: Partial<ChecklistItem>) {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    emitChange(next);
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    emitChange(
      next.length > 0
        ? next
        : [{ text: "", done: false, colaborador_id: null, prazo: null }]
    );
  }

  function addItem() {
    emitChange([
      ...items,
      { text: "", done: false, colaborador_id: null, prazo: null },
    ]);
  }

  return (
    <div
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      data-onboarding="agenda-passos"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <ListChecks size={16} className="text-brand-600" />
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {labelAdornment}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item, index) => {
          const citado = separarPessoaDoPasso(item.text, colaboradores);
          const textoCampo = citado.pessoas.length ? citado.resto : item.text;
          const rotuloEnvio = rotuloEnviadoAgendamento(item);
          const agendamento = item.text.trim()
            ? prazosVios.find(
                (a) =>
                  chaveTexto(a.passo_texto ?? a.observacao) === chaveTexto(item.text) ||
                  chaveTexto(a.passo_texto ?? a.observacao) === chaveTexto(textoCampo)
              )
            : undefined;
          return (
          <li
            key={index}
            className={
              simples
                ? "flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                : "grid items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[1fr] md:grid-cols-[1fr_minmax(10rem,12rem)_8.5rem_auto]"
            }
          >
            <div className={simples ? "min-w-0 flex-1 space-y-2" : "min-w-0"}>
              <input
                type="text"
                value={rascunhos[index] ?? textoCampo}
                onChange={(e) => {
                  const digitado = e.target.value;
                  setRascunhos((atual) => ({ ...atual, [index]: digitado }));
                  patchItem(index, {
                    text: recomporPassoComMarcador(digitado, citado.marcador),
                  });
                }}
                onBlur={() =>
                  setRascunhos((atual) => {
                    if (!(index in atual)) return atual;
                    const next = { ...atual };
                    delete next[index];
                    return next;
                  })
                }
                placeholder="Descreva a ação..."
                className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {citado.pessoas.length > 0 && (
                <ResponsaveisSugeridos pessoas={citado.pessoas} />
              )}
              {agendamento ? (
                <StatusVios a={agendamento} colaboradores={colaboradores} onAlterado={onAgendamentoAlterado} />
              ) : (
                rotuloEnvio && <Badge tone="green">{rotuloEnvio}</Badge>
              )}
            </div>
            {!simples && (
              <>
                <SelectMenu
                  value={item.colaborador_id ?? ""}
                  onChange={(v) =>
                    patchItem(index, { colaborador_id: v || null })
                  }
                  emptyOption="Responsável BP"
                  options={colaboradores.map((c) => ({
                    value: c.id,
                    label: c.nome,
                  }))}
                />
                <input
                  type="date"
                  value={item.prazo ?? ""}
                  onChange={(e) =>
                    patchItem(index, { prazo: e.target.value || null })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  aria-label="Prazo"
                />
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              aria-label="Remover ação"
              className="shrink-0"
            >
              <Trash2 size={15} className="text-slate-400" />
            </Button>
          </li>
          );
        })}
      </ul>

      {(() => {
        const soltos = prazosVios.filter((a) => {
          const chave = chaveTexto(a.passo_texto ?? a.observacao);
          if (!chave) return true;
          return !items.some((item) => {
            const citado = separarPessoaDoPasso(item.text, colaboradores);
            return (
              chaveTexto(item.text) === chave ||
              chaveTexto(citado.resto) === chave
            );
          });
        });
        if (soltos.length === 0) return null;
        return (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            {soltos.map((a) => (
              <StatusVios key={a.id} a={a} colaboradores={colaboradores} onAlterado={onAgendamentoAlterado} />
            ))}
          </div>
        );
      })()}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
          <Plus size={14} />
          Adicionar ação
        </Button>
        {rodape}
      </div>

      <input
        type="hidden"
        name="proximos_passos"
        value={serializeChecklist(items)}
      />

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
