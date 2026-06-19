"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { MarkdownTextarea } from "@/components/ui/MarkdownTextarea";
import { DatetimeBrInput } from "@/components/ui/DatetimeBrInput";
import { Button } from "@/components/ui/Button";
import { ParticipantesPicker } from "@/components/colaboradores/ParticipantesPicker";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ClienteSelect } from "@/components/clientes/ClienteSelect";
import {
  TIPO_REUNIAO_DESCRICAO,
  MODALIDADE_REUNIAO,
  STATUS_REUNIAO,
  tipoReuniaoOptions,
  reuniaoTipoUsaGrupoInterno,
  type TipoReuniaoKey,
} from "@/lib/constants";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { TipoReuniao, ModalidadeReuniao } from "@/types/database";
import { toDatetimeLocal } from "@/lib/format";
import { validateFields, type FieldErrors } from "@/lib/validate";
import {
  buscarConteudoFellow,
  createReuniao,
  updateReuniao,
} from "@/lib/reunioes/actions";
import { buscarReuniaoPorOutlookEventId, reverterCategorizacaoReuniao } from "@/app/(app)/calendario/actions";
import { resolverClienteVios, resolverGrupoGestaoEquipe, sugerirClientePorTituloReuniao } from "@/app/(app)/clientes/actions";
import type { ClienteBusca } from "@/app/(app)/clientes/actions";
import type { ReuniaoComRelacoes } from "@/types/database";
import { labelGrupoCliente } from "@/lib/clientes";
import { Loader2, Undo2 } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFellowFetchProgress } from "@/components/reunioes/useFellowFetchProgress";
import { ProximosPassosChecklist } from "@/components/reunioes/ProximosPassosChecklist";
import { ReuniaoOutlookCabecalho } from "@/components/reunioes/ReuniaoOutlookCabecalho";
import {
  FellowImportLabelActions,
  fellowMotivoParaStatusImport,
  type FellowImportStatus,
} from "@/components/reunioes/FellowImportStatus";
import {
  FELLOW_MSG_PARCIAL_PASSOS,
  FELLOW_MSG_PARCIAL_RESUMO,
  type FellowImportMotivo,
} from "@/lib/fellow-messages";

type ReuniaoPrefill = Partial<ReuniaoComRelacoes> & {
  dono_calendario_id?: string;
};

type ClientePrefill = {
  ci: string;
  nome: string;
  grupo: string | null;
  kind: "grupo" | "empresa";
};

function parseExternos(
  raw: FormDataEntryValue | null
): { nome: string; email: string }[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((p) => ({
        nome: String(p?.nome ?? "").trim(),
        email: String(p?.email ?? "").trim(),
      }))
      .filter((p) => p.nome || p.email);
  } catch {
    return [];
  }
}

function clienteParaPrefill(c: ClienteBusca): ClientePrefill {
  const kind = c.kind ?? "empresa";
  return {
    ci: c.ci,
    nome: kind === "grupo" ? labelGrupoCliente(c.grupo_cliente) : c.nome,
    grupo: c.grupo_cliente ?? null,
    kind,
  };
}

export function ReuniaoForm({
  open,
  onClose,
  onSaved,
  reuniao,
  prefill,
  afterCreate,
  colaboradores,
  usuarios = [],
  fellowAtivo = false,
  donoCalendarioId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reuniao?: ReuniaoComRelacoes | null;
  prefill?: ReuniaoPrefill | null;
  afterCreate?: (id: string) => Promise<void> | void;
  colaboradores: ColaboradorOpt[];
  usuarios?: { id: string; nome: string; email: string; avatar_url?: string | null }[];
  fellowAtivo?: boolean;
  /** Dono do calendário Outlook (admin abrindo reunião de outro sócio). */
  donoCalendarioId?: string | null;
}) {
  const editing = Boolean(reuniao);
  const src = reuniao ?? prefill ?? null;
  /** Horários vêm do Outlook — não editáveis neste sistema. */
  const horarioSomenteLeitura = Boolean(
    src?.outlook_event_id ||
      prefill?.outlook_event_id ||
      prefill?.dono_calendario_id ||
      reuniao?.outlook_event_id
  );
  const formFieldId = useId();
  const fieldId = (name: string) => `${formFieldId}-${name}`;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [revertPending, startRevertTransition] = useTransition();
  const [, startFellowTransition] = useTransition();
  const [fellowBusy, setFellowBusy] = useState(false);
  const { progress: fellowProgress, stepLabel: fellowStepLabel, complete: completeFellowProgress } =
    useFellowFetchProgress(fellowBusy);
  const [fellowMsg, setFellowMsg] = useState<string>();
  const [fellowResumoStatus, setFellowResumoStatus] =
    useState<FellowImportStatus>("idle");
  const [fellowResumoDetail, setFellowResumoDetail] = useState<string>();
  const [fellowPassosStatus, setFellowPassosStatus] =
    useState<FellowImportStatus>("idle");
  const [fellowPassosDetail, setFellowPassosDetail] = useState<string>();
  const [fellowImportMotivo, setFellowImportMotivo] =
    useState<FellowImportMotivo>();
  const [resultadoTexto, setResultadoTexto] = useState(src?.resultado ?? "");
  const [proximosPassos, setProximosPassos] = useState(src?.proximos_passos ?? "");
  const tituloRef = useRef<HTMLInputElement>(null);
  const inicioRef = useRef<HTMLInputElement>(null);
  const clienteManualRef = useRef(false);
  const tituloDebounceRef = useRef<number>(0);
  const [clienteSugerido, setClienteSugerido] = useState(false);
  const [modalidade, setModalidade] = useState(
    src?.modalidade ?? "PRESENCIAL_ESCRITORIO"
  );
  const [status, setStatus] = useState(src?.status ?? "AGENDADA");
  const [tipo, setTipo] = useState<TipoReuniao>(src?.tipo ?? "CAPTACAO");
  const [clientePrefill, setClientePrefill] = useState<ClientePrefill | null>(() => {
    const ci = src?.cliente_id ?? src?.cliente?.ci ?? "";
    if (!ci && !src?.cliente?.nome) return null;
    return {
      ci,
      nome: src?.cliente?.nome ?? "",
      grupo: src?.cliente?.grupo_cliente ?? null,
      kind: "empresa",
    };
  });

  const participantesIniciais = (src?.participantes ?? [])
    .filter((p) => p.colaborador_id)
    .map((p) => p.colaborador_id as string);
  const externosIniciais = (src?.participantes ?? [])
    .filter((p) => !p.colaborador_id && (p.nome || p.email))
    .map((p) => ({ nome: p.nome ?? "", email: p.email ?? "" }));

  const prefillKey = [
    prefill?.outlook_event_id,
    prefill?.titulo,
    prefill?.data_hora_inicio,
  ].join("|");

  const fellowAutoFetch =
    open &&
    fellowAtivo &&
    (src?.status === "REALIZADA" || status === "REALIZADA");

  const fellowSourceKey = [reuniao?.id ?? "", prefillKey].join("|");

  useEffect(() => {
    if (!open) {
      setFellowMsg(undefined);
      setFellowBusy(false);
      setFellowResumoStatus("idle");
      setFellowResumoDetail(undefined);
      setFellowPassosStatus("idle");
      setFellowPassosDetail(undefined);
      setFellowImportMotivo(undefined);
      return;
    }
    setFellowResumoStatus("idle");
    setFellowResumoDetail(undefined);
    setFellowPassosStatus("idle");
    setFellowPassosDetail(undefined);
    setFellowImportMotivo(undefined);
    if (fellowAutoFetch) {
      setFellowBusy(true);
      setFellowResumoStatus("loading");
      setFellowPassosStatus("loading");
    }
    setResultadoTexto(src?.resultado ?? "");
    setProximosPassos(src?.proximos_passos ?? "");
    if (prefill?.modalidade) setModalidade(prefill.modalidade);
    if (prefill?.status) setStatus(prefill.status);
  }, [
    open,
    fellowAutoFetch,
    prefillKey,
    reuniao?.id,
    src?.resultado,
    src?.proximos_passos,
    prefill?.modalidade,
    prefill?.status,
  ]);

  useEffect(() => {
    if (!open) return;
    clienteManualRef.current = false;
    setClienteSugerido(false);
  }, [open, prefillKey, reuniao?.id]);

  function aplicarClienteSugerido(
    c: Awaited<ReturnType<typeof sugerirClientePorTituloReuniao>>
  ) {
    if (!c || clienteManualRef.current) return;
    setClientePrefill(clienteParaPrefill({ ...c, kind: "grupo" }));
    setClienteSugerido(true);
  }

  function sugerirClienteDoTitulo(titulo: string) {
    if (clienteManualRef.current || reuniaoTipoUsaGrupoInterno(tipo)) return;
    const ci = src?.cliente_id ?? src?.cliente?.ci ?? "";
    if (ci) return;

    const t = titulo.trim();
    if (t.length < 3) {
      setClientePrefill(null);
      setClienteSugerido(false);
      return;
    }

    void sugerirClientePorTituloReuniao(t).then((c) => {
      if (clienteManualRef.current) return;
      if (c) aplicarClienteSugerido(c);
      else {
        setClientePrefill(null);
        setClienteSugerido(false);
      }
    });
  }

  function handleTituloChange() {
    window.clearTimeout(tituloDebounceRef.current);
    tituloDebounceRef.current = window.setTimeout(() => {
      sugerirClienteDoTitulo(tituloRef.current?.value ?? "");
    }, 400);
  }

  function aplicarClienteGestaoEquipe() {
    void resolverGrupoGestaoEquipe().then((c) => {
      if (!c || clienteManualRef.current) return;
      setClientePrefill(clienteParaPrefill(c));
      setClienteSugerido(false);
    });
  }

  function handleTipoChange(v: string) {
    const next = v as TipoReuniao;
    if (reuniaoTipoUsaGrupoInterno(next as TipoReuniaoKey)) {
      clienteManualRef.current = false;
    }
    setTipo(next);
  }

  useEffect(() => {
    if (!open) return;

    if (reuniaoTipoUsaGrupoInterno(tipo)) {
      aplicarClienteGestaoEquipe();
      return;
    }

    const ci = src?.cliente_id ?? src?.cliente?.ci ?? "";
    const nome = src?.cliente?.nome ?? "";
    const grupo = src?.cliente?.grupo_cliente ?? null;

    if (ci) {
      setClientePrefill({ ci, nome, grupo, kind: "empresa" });
      setClienteSugerido(false);
      return;
    }

    if (nome.trim()) {
      let cancelled = false;
      void resolverClienteVios(nome, grupo).then((c) => {
        if (cancelled || clienteManualRef.current) return;
        if (c) {
          setClientePrefill(clienteParaPrefill(c));
        } else {
          setClientePrefill({ ci: "", nome, grupo, kind: "empresa" });
        }
        setClienteSugerido(false);
      });

      return () => {
        cancelled = true;
      };
    }

    const titulo = src?.titulo?.trim() ?? "";
    if (!titulo) {
      setClientePrefill(null);
      setClienteSugerido(false);
      return;
    }

    let cancelled = false;
    void sugerirClientePorTituloReuniao(titulo).then((c) => {
      if (cancelled || clienteManualRef.current) return;
      if (c) aplicarClienteSugerido(c);
      else {
        setClientePrefill(null);
        setClienteSugerido(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    tipo,
    prefillKey,
    reuniao?.id,
    src?.cliente_id,
    src?.cliente?.ci,
    src?.cliente?.nome,
    src?.cliente?.grupo_cliente,
    src?.titulo,
  ]);

  // Preenche a duração ao informar início + fim (sem sobrescrever valor manual).
  const lastAutoDur = useRef<string>("");
  function autoFillDuracao(e: FormEvent<HTMLInputElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    const inicio = (form.elements.namedItem("data_hora_inicio") as HTMLInputElement)?.value;
    const fim = (form.elements.namedItem("data_hora_fim") as HTMLInputElement)?.value;
    const dur = form.elements.namedItem("duracao_minutos") as HTMLInputElement | null;
    if (!inicio || !fim || !dur) return;
    if (dur.value && dur.value !== lastAutoDur.current) return;
    const min = Math.round(
      (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000
    );
    if (min > 0) {
      dur.value = String(min);
      lastAutoDur.current = String(min);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const fd = new FormData(e.currentTarget);
    const values = {
      titulo: String(fd.get("titulo") ?? ""),
      tipo: String(fd.get("tipo") ?? ""),
      modalidade: String(fd.get("modalidade") ?? ""),
      status: String(fd.get("status") ?? ""),
      data_hora_inicio: String(fd.get("data_hora_inicio") ?? ""),
      data_hora_fim: String(fd.get("data_hora_fim") ?? ""),
      duracao_minutos: fd.get("duracao_minutos")
        ? Number(fd.get("duracao_minutos"))
        : undefined,
      cliente_id: String(fd.get("cliente_id") ?? ""),
      link_online: String(fd.get("link_online") ?? ""),
      local: String(fd.get("local") ?? ""),
      objetivos: String(fd.get("objetivos") ?? ""),
      resultado:
        status === "REALIZADA" ? resultadoTexto : String(fd.get("resultado") ?? ""),
      proximos_passos:
        status === "REALIZADA"
          ? proximosPassos
          : String(fd.get("proximos_passos") ?? ""),
      motivo_cancelamento: String(fd.get("motivo_cancelamento") ?? ""),
      participantes: fd.getAll("participantes").map(String),
      participantes_externos: parseExternos(fd.get("participantes_externos")),
      ...(prefill?.dono_calendario_id
        ? { dono_calendario_id: prefill.dono_calendario_id }
        : {}),
    };

    const errs = validateFields(
      {
        ...values,
        duracao_minutos:
          values.duracao_minutos != null ? String(values.duracao_minutos) : "",
      },
      {
        titulo: { required: "Informe o título da reunião." },
        data_hora_inicio: { required: "Informe a data e hora de início." },
        data_hora_fim: {
          required: "Informe a data e hora de fim.",
          afterField: {
            field: "data_hora_inicio",
            message: "O fim deve ser depois do início.",
          },
        },
        duracao_minutos: {
          required: "Informe a duração em minutos.",
          min: { value: 1, message: "Duração deve ser maior que zero." },
        },
        cliente_id: { required: "Selecione ou crie um cliente." },
        link_online: { url: "Link inválido — use http(s)://..." },
        ...(modalidade === "PRESENCIAL_EXTERNO"
          ? { local: { required: "Informe o local." } }
          : {}),
        ...(status === "CANCELADA"
          ? {
              motivo_cancelamento: {
                required: "Informe o motivo do cancelamento.",
              },
            }
          : {}),
      }
    );

    if (
      values.participantes.length === 0 &&
      values.participantes_externos.length === 0
    ) {
      errs.participantes = "Selecione ao menos um participante.";
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      if (!editing && prefill?.outlook_event_id && afterCreate) {
        const existenteId = await buscarReuniaoPorOutlookEventId(
          prefill.outlook_event_id
        );
        if (existenteId) {
          try {
            await afterCreate(existenteId);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Erro ao vincular o evento do calendário."
            );
            return;
          }
          onSaved();
          onClose();
          return;
        }
      }

      const r = editing
        ? await updateReuniao(reuniao!.id, values)
        : await createReuniao(values);
      if (r.ok) {
        if (!editing && r.id && afterCreate) {
          try {
            await afterCreate(r.id);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Erro ao vincular o evento do calendário."
            );
            return;
          }
        }
        onSaved();
        onClose();
      } else {
        setError(r.error ?? "Erro ao salvar.");
      }
    });
  }

  function aplicarFellow(
    r: Awaited<ReturnType<typeof buscarConteudoFellow>>,
    origem: "auto" | "manual"
  ) {
    const preservarConteudo = origem === "auto" && editing;

    if (!r.ok) {
      const statusImport = fellowMotivoParaStatusImport(r.motivo, r.error);
      const motivo =
        r.motivo === "sem_gravacao" || r.motivo === "sem_conteudo_ia"
          ? r.motivo
          : undefined;
      setFellowImportMotivo(motivo);
      setFellowResumoStatus(statusImport);
      setFellowResumoDetail(r.error);
      setFellowPassosStatus(statusImport);
      setFellowPassosDetail(r.error);
      setFellowMsg(r.error ?? "Não foi possível importar do Fellow.");
      return;
    }

    setFellowImportMotivo(undefined);

    if (preservarConteudo) {
      if (r.resultado && !resultadoTexto.trim()) setResultadoTexto(r.resultado);
      if (r.proximos_passos && !proximosPassos.trim()) {
        setProximosPassos(r.proximos_passos);
      }
    } else {
      if (r.resultado) setResultadoTexto(r.resultado);
      if (r.proximos_passos) setProximosPassos(r.proximos_passos);
    }

    if (r.resultado?.trim()) {
      setFellowResumoStatus("success");
      setFellowResumoDetail(undefined);
    } else {
      setFellowResumoStatus("not_found");
      setFellowResumoDetail(FELLOW_MSG_PARCIAL_RESUMO);
    }

    if (r.proximos_passos?.trim()) {
      setFellowPassosStatus("success");
      setFellowPassosDetail(undefined);
    } else {
      setFellowPassosStatus("not_found");
      setFellowPassosDetail(FELLOW_MSG_PARCIAL_PASSOS);
    }

    if (preservarConteudo) {
      if (
        !r.resultado?.trim() &&
        !r.proximos_passos?.trim()
      ) {
        setFellowMsg(undefined);
      }
      return;
    }

    const partes = [
      origem === "auto"
        ? "Conteúdo carregado automaticamente do Fellow."
        : "Conteúdo importado do Fellow.",
    ];
    if (r.tem_resumo_ia) partes.push("resumo (Summary)");
    if (r.proximos_passos) partes.push("ações (Action items)");
    setFellowMsg(partes.join(" · "));
  }

  function parametrosFellow() {
    const titulo =
      tituloRef.current?.value?.trim() || src?.titulo?.trim() || "";
    const data_hora_inicio =
      inicioRef.current?.value ||
      (src?.data_hora_inicio ? toDatetimeLocal(src.data_hora_inicio) : "");

    return {
      outlook_event_id: reuniao?.outlook_event_id ?? src?.outlook_event_id,
      titulo,
      data_hora_inicio: data_hora_inicio
        ? new Date(data_hora_inicio).toISOString()
        : src?.data_hora_inicio,
    };
  }

  useEffect(() => {
    if (!fellowAutoFetch || !src) return;

    let cancelled = false;
    startFellowTransition(async () => {
      setFellowMsg(undefined);
      if (fellowAtivo) {
        setFellowResumoStatus("loading");
        setFellowResumoDetail(undefined);
        setFellowPassosStatus("loading");
        setFellowPassosDetail(undefined);
      }
      try {
        const r = await buscarConteudoFellow({
          outlook_event_id: src.outlook_event_id,
          titulo: src.titulo,
          data_hora_inicio: src.data_hora_inicio,
        });
        if (!cancelled) aplicarFellow(r, "auto");
      } finally {
        if (!cancelled) {
          await completeFellowProgress();
          setFellowBusy(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    fellowAutoFetch,
    fellowSourceKey,
    src?.outlook_event_id,
    src?.titulo,
    src?.data_hora_inicio,
  ]);

  function handleImportarFellow() {
    setFellowMsg(undefined);
    setFellowBusy(true);
    if (fellowAtivo) {
      setFellowResumoStatus("loading");
      setFellowResumoDetail(undefined);
      setFellowPassosStatus("loading");
      setFellowPassosDetail(undefined);
    }
    startFellowTransition(async () => {
      try {
        const r = await buscarConteudoFellow(parametrosFellow());
        aplicarFellow(r, "manual");
      } finally {
        await completeFellowProgress();
        setFellowBusy(false);
      }
    });
  }

  function handleClose() {
    if (fellowBusy) return;
    onClose();
  }

  const podeReverterOutlook = editing && horarioSomenteLeitura && Boolean(reuniao?.id);

  function handleReverterOutlook() {
    if (!reuniao?.id || fellowBusy || pending || revertPending) return;
    setError(undefined);
    startRevertTransition(async () => {
      const r = await reverterCategorizacaoReuniao(
        reuniao.id,
        donoCalendarioId ?? prefill?.dono_calendario_id
      );
      if (!r.ok) {
        setError(r.error ?? "Erro ao reverter categorização.");
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeDisabled={fellowBusy}
      title={editing ? "Editar Reclassificação Reunião" : "Reclassificação Reunião"}
      size="xl"
    >
      <div className="relative">
        {fellowBusy && (
          <div
            className="sticky top-0 z-10 -mx-5 -mt-4 mb-4 flex items-start gap-3 border-b border-brand-100 bg-white/95 px-5 py-4 backdrop-blur-sm sm:-mx-6 sm:-mt-5 sm:px-6"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2
              size={24}
              className="mt-0.5 shrink-0 animate-spin text-brand-600"
            />
            <div className="min-w-0 flex-1 space-y-2 text-left">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800">
                  Buscando conteúdo no Fellow…
                </p>
                <p className="text-xs text-slate-500">{fellowStepLabel}</p>
              </div>
              <ProgressBar value={fellowProgress} label={fellowStepLabel} />
            </div>
          </div>
        )}
      <form
        onSubmit={handleSubmit}
        noValidate
        className={clsx(
          "flex flex-col gap-4",
          fellowBusy && "pointer-events-none select-none opacity-50"
        )}
        aria-hidden={fellowBusy}
      >
        {horarioSomenteLeitura ? (
          <ReuniaoOutlookCabecalho
            titulo={src?.titulo ?? ""}
            dataHoraInicio={src?.data_hora_inicio}
            dataHoraFim={src?.data_hora_fim}
            duracaoMinutos={src?.duracao_minutos}
            modalidade={modalidade as ModalidadeReuniao}
            tituloRef={tituloRef}
            inicioRef={inicioRef}
            fieldErrors={fieldErrors}
          />
        ) : (
          <Input
            id={fieldId("titulo")}
            name="titulo"
            label="Título"
            ref={tituloRef}
            defaultValue={src?.titulo}
            onChange={handleTituloChange}
            error={fieldErrors.titulo}
            required
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Tipo
              <InfoTooltip text={TIPO_REUNIAO_DESCRICAO[tipo as TipoReuniaoKey]} />
            </span>
            <SelectMenu
              name="tipo"
              value={tipo}
              onChange={handleTipoChange}
              options={tipoReuniaoOptions()}
            />
          </div>
          <SelectMenu
            name="status"
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={Object.entries(STATUS_REUNIAO).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <SelectMenu
            name="modalidade"
            label="Modalidade"
            value={modalidade}
            onChange={(v) => setModalidade(v as typeof modalidade)}
            options={Object.entries(MODALIDADE_REUNIAO).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
        </div>

        <ClienteSelect
          name="cliente_id"
          required
          allowCreateLead={tipo === "CAPTACAO"}
          tooltip={
            tipo === "CAPTACAO"
              ? "Em Captação, vincule o contato da reunião. Se ainda não estiver na base, use + Captação — o nome será salvo em MAIÚSCULAS, categorizado como Captação e vinculado a você."
              : "Vincule o cliente relacionado à reunião. O campo é obrigatório."
          }
          defaultValue={clientePrefill?.ci ?? ""}
          defaultLabel={clientePrefill?.nome ?? ""}
          defaultGrupo={clientePrefill?.grupo}
          defaultKind={clientePrefill?.kind}
          onUserChange={() => {
            clienteManualRef.current = true;
            setClienteSugerido(false);
          }}
          error={fieldErrors.cliente_id}
        />
        {clienteSugerido && (
          <p className="-mt-2 text-xs text-brand-700">
            Cliente sugerido pelo título da reunião — confira antes de salvar.
          </p>
        )}

        <ParticipantesPicker
          key={prefillKey || reuniao?.id || "novo"}
          colaboradores={colaboradores}
          usuarios={usuarios}
          defaultSelected={participantesIniciais}
          defaultExternos={externosIniciais}
          error={fieldErrors.participantes}
        />

        {!horarioSomenteLeitura && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DatetimeBrInput
              id={fieldId("data_hora_inicio")}
              name="data_hora_inicio"
              label="Início"
              ref={inicioRef}
              defaultValue={toDatetimeLocal(src?.data_hora_inicio)}
              error={fieldErrors.data_hora_inicio}
              onChange={autoFillDuracao}
              required
            />
            <DatetimeBrInput
              id={fieldId("data_hora_fim")}
              name="data_hora_fim"
              label="Fim"
              defaultValue={toDatetimeLocal(src?.data_hora_fim)}
              error={fieldErrors.data_hora_fim}
              onChange={autoFillDuracao}
              required
            />
            <Input
              id={fieldId("duracao_minutos")}
              name="duracao_minutos"
              type="number"
              min={1}
              label="Duração (min)"
              defaultValue={src?.duracao_minutos ?? ""}
              error={fieldErrors.duracao_minutos}
              required
            />
          </div>
        )}

        {status === "REALIZADA" && (
          <>
            {fellowAtivo && fellowMsg && (
              <p
                className={clsx(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  fellowResumoStatus === "error"
                    ? "bg-red-50 text-red-800"
                    : fellowResumoStatus === "not_found"
                      ? "bg-orange-50 text-orange-900"
                      : "bg-brand-50 text-brand-800"
                )}
              >
                {fellowMsg}
              </p>
            )}
            <MarkdownTextarea
              id={fieldId("resultado")}
              name="resultado"
              label="Resumo"
              labelAdornment={
                fellowAtivo ? (
                  <FellowImportLabelActions
                    status={fellowResumoStatus}
                    detail={fellowResumoDetail}
                    motivo={fellowImportMotivo}
                    onRefresh={handleImportarFellow}
                    busy={fellowBusy}
                    showRefresh
                  />
                ) : undefined
              }
              value={resultadoTexto}
              onChange={setResultadoTexto}
              error={fieldErrors.resultado}
            />
            <ProximosPassosChecklist
              value={proximosPassos}
              onChange={setProximosPassos}
              error={fieldErrors.proximos_passos}
              labelAdornment={
                fellowAtivo ? (
                  <FellowImportLabelActions
                    status={fellowPassosStatus}
                    detail={fellowPassosDetail}
                    motivo={fellowImportMotivo}
                    reserveRefreshSpace
                  />
                ) : undefined
              }
            />
          </>
        )}

        {/* Condicional: PRESENCIAL EXTERNO */}
        {modalidade === "PRESENCIAL_EXTERNO" && (
          <Input
            id={fieldId("local")}
            name="local"
            label="Local (endereço ou nome)"
            defaultValue={src?.local ?? ""}
            error={fieldErrors.local}
            required
          />
        )}

        {/* Condicional: CANCELADA */}
        {status === "CANCELADA" && (
          <Textarea
            id={fieldId("motivo_cancelamento")}
            name="motivo_cancelamento"
            label="Motivo do cancelamento"
            defaultValue={src?.motivo_cancelamento ?? ""}
            error={fieldErrors.motivo_cancelamento}
            required
          />
        )}

        {modalidade === "ONLINE" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <Input
              id={fieldId("link_online")}
              name="link_online"
              label="Link da reunião (opcional)"
              placeholder="https://teams.microsoft.com/..."
              defaultValue={src?.link_online ?? ""}
              error={fieldErrors.link_online}
            />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {podeReverterOutlook ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 px-2 py-1 text-xs text-slate-500"
              disabled={pending || fellowBusy || revertPending}
              onClick={handleReverterOutlook}
            >
              <Undo2 size={13} />
              {revertPending ? "Revertendo..." : "Voltar para não categorizado"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={fellowBusy || revertPending}
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || fellowBusy || revertPending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </Modal>
  );
}
