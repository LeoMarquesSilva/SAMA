"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { EmailChips } from "@/components/ui/EmailChips";
import { MarkdownTextarea } from "@/components/ui/MarkdownTextarea";
import {
  OutlookDateTimeRange,
  proximoSlotLocal,
} from "@/components/ui/OutlookDateTimeRange";
import { Button } from "@/components/ui/Button";
import { ParticipantesPicker } from "@/components/colaboradores/ParticipantesPicker";
import type { ColaboradorOpt } from "@/lib/colaboradores";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ClienteSelect } from "@/components/clientes/ClienteSelect";
import {
  MODALIDADE_REUNIAO,
  STATUS_REUNIAO,
  demandaReuniaoOptions,
} from "@/lib/constants";
import {
  descricaoTipoReuniao,
  opcoesTipoReuniao,
  tipoReuniaoPadrao,
  tiposReuniaoPadrao,
  tipoUsaGrupoInterno,
  type TipoReuniaoItem,
} from "@/lib/reuniao-tipos";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { DemandaReuniao, ModalidadeReuniao } from "@/types/database";
import { toDatetimeLocal } from "@/lib/format";
import { datetimeLocalSpToIso } from "@/lib/datetime-br";
import { validateFields, type FieldErrors } from "@/lib/validate";
import {
  buscarConteudoFellow,
  buscarReuniaoPorId,
  createReuniao,
  updateReuniao,
} from "@/lib/reunioes/actions";
import { buscarReuniaoPorOutlookEventId, reverterCategorizacaoReuniao } from "@/app/(app)/calendario/actions";
import { listarEmailsExternosDoGrupo, resolverClienteVios, resolverGrupoGestaoEquipe, sugerirClientePorTituloReuniao } from "@/app/(app)/clientes/actions";
import type { ClienteBusca } from "@/app/(app)/clientes/actions";
import type { ReuniaoComRelacoes } from "@/types/database";
import { labelGrupoCliente } from "@/lib/clientes";
import {
  CalendarClock,
  FileText,
  Loader2,
  Lock,
  Mail,
  Send,
  Tags,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useFellowFetchProgress } from "@/components/reunioes/useFellowFetchProgress";
import { ProximosPassosChecklist } from "@/components/reunioes/ProximosPassosChecklist";
import { AgendarViosModal } from "@/components/reunioes/AgendarViosModal";
import {
  listarAgendamentosVios,
  type AgendamentoViosStatus,
} from "@/lib/vios-status-actions";
import { PautaFields } from "@/components/reunioes/PautaFields";
import { ReunioesAnterioresPanel } from "@/components/reunioes/ReunioesAnterioresPanel";
import { parsePauta, pautaVazia, type PautaReuniao } from "@/lib/pauta";
import { enviarAtaParaCliente } from "@/lib/reunioes/pauta-email";
import {
  checklistTemItens,
  marcarPassosEnviadosVios,
  mesclarChecklists,
  removerDoChecklist,
} from "@/lib/proximos-passos-checklist";
import { proximosPassosUnificados } from "@/lib/reuniao-todos";
import { SALA_SOMENTE_ONLINE } from "@/lib/salas";
import {
  agendarReuniaoViaB,
  enviarReuniaoAoVios,
  sincronizarReuniaoNoOutlook,
} from "@/lib/reunioes/outlook-write";
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

function Secao({
  icon: Icon,
  titulo,
  children,
  destaque,
  acoes,
}: {
  icon: LucideIcon;
  titulo: string;
  children: React.ReactNode;
  destaque?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      data-onboarding={destaque}
    >
      <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
        <span className="flex items-center gap-2">
          <Icon size={16} className="text-brand-600" />
          {titulo}
        </span>
        {acoes}
      </h3>
      {children}
    </section>
  );
}

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
  tiposReuniao,
  usuarios = [],
  fellowAtivo = false,
  donoCalendarioId,
  modoViaB = false,
  tourDestaque = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reuniao?: ReuniaoComRelacoes | null;
  prefill?: ReuniaoPrefill | null;
  afterCreate?: (id: string) => Promise<void> | void;
  colaboradores: ColaboradorOpt[];
  /** Tipos de classificação cadastrados em Configurações. */
  tiposReuniao?: TipoReuniaoItem[];
  usuarios?: { id: string; nome: string; email: string; avatar_url?: string | null }[];
  fellowAtivo?: boolean;
  /** Dono do calendário Outlook (admin abrindo reunião de outro sócio). */
  donoCalendarioId?: string | null;
  /** Via B: agendar no SAMA e criar no Outlook. */
  modoViaB?: boolean;
  /** Passo do tour que precisa deixar o bloco visível para o destaque. */
  tourDestaque?: string | null;
}) {
  // Sem a lista do banco (ex.: migration 0047 não aplicada), usa a do código.
  const tipos = tiposReuniao?.length ? tiposReuniao : tiposReuniaoPadrao();
  const editing = Boolean(reuniao);
  const src = reuniao ?? prefill ?? null;
  const origemSama = src?.origem === "SAMA" || modoViaB;
  /** Via A: horários vêm do Outlook. Via B: editáveis no SAMA. */
  const agendarNovo = modoViaB && !editing;
  const horarioSomenteLeitura = Boolean(
    !modoViaB &&
      !origemSama &&
      (src?.outlook_event_id ||
        prefill?.outlook_event_id ||
        prefill?.dono_calendario_id ||
        reuniao?.outlook_event_id)
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
  const [proximosPassos, setProximosPassos] = useState(() =>
    proximosPassosUnificados(src?.proximos_passos, src?.todos)
  );
  const tituloRef = useRef<HTMLInputElement>(null);
  const inicioRef = useRef<HTMLInputElement>(null);
  const slotPadrao = proximoSlotLocal();
  const [slotInicio, setSlotInicio] = useState(() =>
    src?.data_hora_inicio
      ? toDatetimeLocal(src.data_hora_inicio)
      : slotPadrao.inicio
  );
  const [slotFim, setSlotFim] = useState(() =>
    src?.data_hora_fim ? toDatetimeLocal(src.data_hora_fim) : slotPadrao.fim
  );
  const clienteManualRef = useRef(false);
  const tituloDebounceRef = useRef<number>(0);
  const [clienteSugerido, setClienteSugerido] = useState(false);
  const [modalidade, setModalidade] = useState(
    src?.modalidade ?? "PRESENCIAL_ESCRITORIO"
  );
  const [status, setStatus] = useState(src?.status ?? "AGENDADA");
  const [tipo, setTipo] = useState<string>(src?.tipo ?? tipoReuniaoPadrao(tipos));
  const [demanda, setDemanda] = useState<DemandaReuniao | "">(src?.demanda ?? "");
  const [ataRestrita, setAtaRestrita] = useState(Boolean(src?.ata_restrita));
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
  const [clienteIdAtual, setClienteIdAtual] = useState(
    src?.cliente_id ?? src?.cliente?.ci ?? ""
  );
  const [pauta, setPauta] = useState<PautaReuniao>(() => parsePauta(src?.pauta));
  const [sala, setSala] = useState(src?.sala ?? (modoViaB ? SALA_SOMENTE_ONLINE : ""));
  const [emailsCliente, setEmailsCliente] = useState<string[]>(
    src?.emails_cliente ?? []
  );
  const [emailsGrupoBusy, setEmailsGrupoBusy] = useState(false);
  const emailsAutoRef = useRef<string[]>([]);
  const emailsGrupoPedidoRef = useRef("");
  const [viosMsg, setViosMsg] = useState<string>();
  const [pautaMsg, setPautaMsg] = useState<{ ok: boolean; texto: string }>();
  const [pautaEnviando, startPautaTransition] = useTransition();
  const [agendamentosVios, setAgendamentosVios] = useState<AgendamentoViosStatus[]>([]);
  const [pessoasAgenda, setPessoasAgenda] = useState<{ nome: string; email: string }[]>([]);
  const avisarPessoasAgenda = useCallback(
    (pessoas: { nome: string; email: string }[]) => setPessoasAgenda(pessoas),
    []
  );
  const [viosRecarregar, setViosRecarregar] = useState(0);

  // Situação no VIOS de cada passo enviado (atualiza sozinho enquanto há itens na fila)
  useEffect(() => {
    const reuniaoId = reuniao?.id;
    if (!open || !reuniaoId) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const carregar = async () => {
      const lista = await listarAgendamentosVios(reuniaoId).catch(
        () => [] as AgendamentoViosStatus[]
      );
      if (!vivo) return;
      setAgendamentosVios(lista);
      if (lista.some((a) => a.status !== "concluido" && a.status !== "erro")) {
        timer = setTimeout(carregar, 15_000);
      }
    };
    void carregar();
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [open, reuniao?.id, viosRecarregar]);
  const [viosAberto, setViosAberto] = useState(false);
  const reuniaoJaPassou = Boolean(
    editing &&
      reuniao?.id &&
      (status === "REALIZADA" ||
        (src?.data_hora_fim
          ? new Date(src.data_hora_fim).getTime() < Date.now()
          : src?.data_hora_inicio
            ? new Date(src.data_hora_inicio).getTime() < Date.now()
            : false))
  );
  const podeAgendarVios =
    reuniaoJaPassou && checklistTemItens(proximosPassos);

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
    !editing &&
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
    if (!editing) {
      setResultadoTexto(src?.resultado ?? "");
      setProximosPassos(
        proximosPassosUnificados(src?.proximos_passos, src?.todos)
      );
      setPauta(parsePauta(src?.pauta));
      setSala(src?.sala ?? (modoViaB ? SALA_SOMENTE_ONLINE : ""));
      setEmailsCliente(src?.emails_cliente ?? []);
      setDemanda(src?.demanda ?? "");
      setAtaRestrita(Boolean(src?.ata_restrita));
      emailsAutoRef.current = [];
      emailsGrupoPedidoRef.current = "";
      setClienteIdAtual(src?.cliente_id ?? src?.cliente?.ci ?? "");
      const padrao = proximoSlotLocal();
      setSlotInicio(
        src?.data_hora_inicio
          ? toDatetimeLocal(src.data_hora_inicio)
          : padrao.inicio
      );
      setSlotFim(
        src?.data_hora_fim ? toDatetimeLocal(src.data_hora_fim) : padrao.fim
      );
    }
    if (prefill?.modalidade) setModalidade(prefill.modalidade);
    if (prefill?.status) setStatus(prefill.status);
  }, [
    open,
    editing,
    fellowAutoFetch,
    prefillKey,
    reuniao?.id,
    src?.resultado,
    src?.proximos_passos,
    prefill?.modalidade,
    prefill?.status,
  ]);

  useEffect(() => {
    if (!open || !editing || !reuniao?.id) return;

    let cancelled = false;
    void buscarReuniaoPorId(reuniao.id).then((fresh) => {
      if (cancelled || !fresh) return;
      setResultadoTexto(fresh.resultado ?? "");
      setProximosPassos(
        proximosPassosUnificados(fresh.proximos_passos, fresh.todos)
      );
      if (fresh.modalidade) setModalidade(fresh.modalidade);
      if (fresh.status) setStatus(fresh.status);
      setDemanda(fresh.demanda ?? "");
      setAtaRestrita(Boolean(fresh.ata_restrita));
    });

    return () => {
      cancelled = true;
    };
  }, [open, editing, reuniao?.id]);

  useEffect(() => {
    if (!open) return;
    clienteManualRef.current = false;
    setClienteSugerido(false);
  }, [open, prefillKey, reuniao?.id]);

  function aplicarEmailsDoGrupo(grupo: string | null | undefined, lista: string[]) {
    const autoAntes = new Set(emailsAutoRef.current.map((e) => e.toLowerCase()));
    emailsAutoRef.current = lista;
    setEmailsCliente((atual) => {
      const manuais = atual.filter((e) => !autoAntes.has(e.toLowerCase()));
      const vistos = new Set(lista.map((e) => e.toLowerCase()));
      const extras = manuais.filter((e) => !vistos.has(e.toLowerCase()));
      return [...lista, ...extras];
    });
  }

  function preencherEmailsDoGrupo(grupo: string | null | undefined) {
    if (!agendarNovo) return;
    const chave = grupo?.trim() ?? "";
    emailsGrupoPedidoRef.current = chave;
    if (!chave) {
      aplicarEmailsDoGrupo(null, []);
      setEmailsGrupoBusy(false);
      return;
    }
    setEmailsGrupoBusy(true);
    void listarEmailsExternosDoGrupo(chave).then((lista) => {
      if (emailsGrupoPedidoRef.current !== chave) return;
      aplicarEmailsDoGrupo(chave, lista);
      setEmailsGrupoBusy(false);
    });
  }

  function aplicarClienteSugerido(
    c: Awaited<ReturnType<typeof sugerirClientePorTituloReuniao>>
  ) {
    if (!c || clienteManualRef.current) return;
    setClientePrefill(clienteParaPrefill({ ...c, kind: "grupo" }));
    setClienteSugerido(true);
    preencherEmailsDoGrupo(c.grupo_cliente);
  }

  function sugerirClienteDoTitulo(titulo: string) {
    if (clienteManualRef.current || tipoUsaGrupoInterno(tipo, tipos)) return;
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
      preencherEmailsDoGrupo(c.grupo_cliente);
    });
  }

  function handleTipoChange(v: string) {
    if (!agendarNovo && tipoUsaGrupoInterno(v, tipos)) {
      clienteManualRef.current = false;
    }
    setTipo(v);
  }

  useEffect(() => {
    if (!open) return;

    if (tipoUsaGrupoInterno(tipo, tipos)) {
      // Reunião nova começa sem cliente. O grupo interno só entra ao editar.
      if (agendarNovo) {
        if (!clienteManualRef.current) {
          setClientePrefill(null);
          setClienteSugerido(false);
          preencherEmailsDoGrupo(null);
        }
        return;
      }
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
    agendarNovo,
    tipo,
    prefillKey,
    reuniao?.id,
    src?.cliente_id,
    src?.cliente?.ci,
    src?.cliente?.nome,
    src?.cliente?.grupo_cliente,
    src?.titulo,
  ]);

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
      // O link do Teams é gerado pelo Outlook; o campo saiu do formulário.
      link_online: src?.link_online ?? "",
      local: String(fd.get("local") ?? ""),
      objetivos: String(fd.get("objetivos") ?? ""),
      resultado:
        status === "REALIZADA" ? resultadoTexto : String(fd.get("resultado") ?? ""),
      proximos_passos: agendarNovo ? "" : proximosPassos,
      motivo_cancelamento: String(fd.get("motivo_cancelamento") ?? ""),
      participantes: fd.getAll("participantes").map(String),
      participantes_externos: parseExternos(fd.get("participantes_externos")),
      pauta,
      sala: sala || undefined,
      emails_cliente: emailsCliente,
      demanda,
      ata_restrita: ataRestrita,
      origem: origemSama || modoViaB ? "SAMA" : "OUTLOOK",
      ata_texto:
        status === "REALIZADA" ? resultadoTexto : (src?.ata_texto ?? ""),
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
        ? origemSama
          ? await sincronizarReuniaoNoOutlook(reuniao!.id, values)
          : await updateReuniao(reuniao!.id, values)
        : modoViaB
          ? await agendarReuniaoViaB(values)
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
    if (r.tem_topicos_ia) partes.push("tópicos (Topics)");
    if (r.proximos_passos) partes.push("ações (Action items)");
    setFellowMsg(partes.join(" · "));
  }

  function parametrosFellow() {
    const titulo =
      tituloRef.current?.value?.trim() || src?.titulo?.trim() || "";
    const data_hora_inicio =
      slotInicio ||
      (src?.data_hora_inicio ? toDatetimeLocal(src.data_hora_inicio) : "");

    return {
      outlook_event_id: reuniao?.outlook_event_id ?? src?.outlook_event_id,
      titulo,
      data_hora_inicio: data_hora_inicio
        ? datetimeLocalSpToIso(data_hora_inicio)
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

  function handleEnviarAta() {
    setPautaMsg(undefined);
    startPautaTransition(async () => {
      const r = await enviarAtaParaCliente({
        titulo: tituloRef.current?.value?.trim() || src?.titulo || "",
        clienteId: clienteIdAtual || null,
        dataHoraInicio: slotInicio || src?.data_hora_inicio || null,
        emails: emailsCliente,
        ata: resultadoTexto,
      });
      setPautaMsg(
        r.ok
          ? {
              ok: true,
              texto: `Ata enviada para ${(r.enviadosPara ?? []).join(", ")}.`,
            }
          : { ok: false, texto: r.error ?? "Falha ao enviar a ata." }
      );
    });
  }

  const podeEnviarAta =
    resultadoTexto.trim().length > 0 && emailsCliente.length > 0 && !pautaEnviando;

  const acoesAta = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={!podeEnviarAta}
      onClick={handleEnviarAta}
      title={
        emailsCliente.length === 0
          ? "Informe os e-mails do cliente para enviar a ata."
          : !resultadoTexto.trim()
            ? "A ata ainda está vazia."
            : undefined
      }
    >
      {pautaEnviando ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Mail size={14} />
      )}
      {pautaEnviando ? "Enviando…" : "Enviar ata para cliente"}
    </Button>
  );

  function handleClose() {
    if (fellowBusy) return;
    onClose();
  }

  const podeReverterOutlook = editing && horarioSomenteLeitura && Boolean(reuniao?.id);
  // Cancelar vale para reunião futura, em andamento ou já passada: só não faz
  // sentido para quem já está cancelada ou marcada como realizada.
  const podeCancelarEcoa = Boolean(
    editing &&
      origemSama &&
      (status === "AGENDADA" || status === "REAGENDADA")
  );
  const focarMotivo = useRef(false);
  useEffect(() => {
    if (!focarMotivo.current || status !== "CANCELADA") return;
    focarMotivo.current = false;
    document.getElementById(`${formFieldId}-motivo_cancelamento`)?.focus();
  }, [status, formFieldId]);

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

  const mostrarAta = status === "REALIZADA" || tourDestaque === "agenda-ata";
  const secaoAta = mostrarAta ? (
    <Secao
      icon={FileText}
      titulo="Ata"
      destaque="agenda-ata"
      acoes={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {acoesAta}
          {fellowAtivo ? (
            <FellowImportLabelActions
              status={fellowResumoStatus}
              detail={fellowResumoDetail}
              motivo={fellowImportMotivo}
              onRefresh={handleImportarFellow}
              busy={fellowBusy}
              showRefresh
            />
          ) : null}
        </div>
      }
    >
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
        key={reuniao?.id ?? prefillKey}
        id={fieldId("resultado")}
        name="resultado"
        aria-label="Ata"
        value={resultadoTexto}
        onChange={setResultadoTexto}
        error={fieldErrors.resultado}
      />
      {pautaMsg && (
        <p
          className={clsx(
            "rounded-lg px-3 py-2 text-sm",
            pautaMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          )}
        >
          {pautaMsg.texto}
        </p>
      )}
    </Secao>
  ) : null;

  return (
    <>
    <Modal
      open={open}
      onClose={handleClose}
      closeDisabled={fellowBusy}
      title={
        modoViaB
          ? "Agendar reunião"
          : editing
            ? "Editar Reclassificação Reunião"
            : "Reclassificação Reunião"
      }
      size="2xl"
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
        {agendarNovo ? (
          <Secao icon={CalendarClock} titulo="Reunião">
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
          </Secao>
        ) : horarioSomenteLeitura ? (
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
          <Secao icon={CalendarClock} titulo="Reunião">
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
            <OutlookDateTimeRange
              inicio={slotInicio}
              fim={slotFim}
              onChange={({ inicio, fim }) => {
                setSlotInicio(inicio);
                setSlotFim(fim);
              }}
              errorInicio={fieldErrors.data_hora_inicio}
              errorFim={fieldErrors.data_hora_fim}
              errorDuracao={fieldErrors.duracao_minutos}
              sala={modoViaB ? sala : undefined}
              onSalaChange={modoViaB ? setSala : undefined}
              pessoas={pessoasAgenda}
            />
          </Secao>
        )}

        <Secao icon={Tags} titulo="Classificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
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
              onClienteChange={(ci, info) => {
                setClienteIdAtual(ci ?? "");
                preencherEmailsDoGrupo(info?.grupo_cliente);
              }}
              error={fieldErrors.cliente_id}
            />
            {clienteSugerido && (
              <p className="mt-1 text-xs text-brand-700">
                Cliente sugerido pelo título da reunião — confira antes de salvar.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Tipo
              <InfoTooltip text={descricaoTipoReuniao(tipo, tipos)} />
            </span>
            <SelectMenu
              name="tipo"
              value={tipo}
              onChange={handleTipoChange}
              options={opcoesTipoReuniao(tipos, tipo)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Demanda
              <InfoTooltip text="Área da demanda tratada na reunião. Define as regras de providência do fluxo de agendamento." />
            </span>
            <SelectMenu
              name="demanda"
              value={demanda}
              onChange={(v) => setDemanda(v as DemandaReuniao | "")}
              emptyOption="Não definida"
              options={demandaReuniaoOptions()}
            />
          </div>
          {modoViaB && !editing ? (
            <input type="hidden" name="status" value="AGENDADA" />
          ) : (
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
          )}
          <SelectMenu
            name="modalidade"
            label="Modalidade"
            value={modalidade}
            onChange={(v) => {
              const next = v as typeof modalidade;
              setModalidade(next);
              if (!modoViaB) return;
              if (next === "ONLINE") setSala(SALA_SOMENTE_ONLINE);
              if (next === "PRESENCIAL_ESCRITORIO" && sala === SALA_SOMENTE_ONLINE) {
                setSala("SALA_1");
              }
            }}
            options={Object.entries(MODALIDADE_REUNIAO).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          {modalidade === "PRESENCIAL_EXTERNO" && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                id={fieldId("local")}
                name="local"
                label="Local (endereço ou nome)"
                defaultValue={src?.local ?? ""}
                error={fieldErrors.local}
                required
              />
            </div>
          )}
          {status === "CANCELADA" && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Textarea
                id={fieldId("motivo_cancelamento")}
                name="motivo_cancelamento"
                label="Motivo do cancelamento"
                defaultValue={src?.motivo_cancelamento ?? ""}
                error={fieldErrors.motivo_cancelamento}
                required
              />
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:col-span-2 lg:col-span-4">
            <input
              type="checkbox"
              checked={ataRestrita}
              onChange={(e) => setAtaRestrita(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <Lock size={13} className="text-slate-400" />
                Trancar a visualização desta reunião
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                A reunião e a ata ficam visíveis só para os gestores da área e para
                quem registrou.
              </span>
            </span>
          </label>
        </div>
        </Secao>

        {agendarNovo && (
          <>
            <Secao icon={Users} titulo="Pessoas" destaque="agenda-participantes">
              <ParticipantesPicker
                key={prefillKey || reuniao?.id || "novo"}
                colaboradores={colaboradores}
                usuarios={usuarios}
                defaultSelected={participantesIniciais}
                defaultExternos={externosIniciais}
                error={fieldErrors.participantes}
                onPessoasChange={avisarPessoasAgenda}
              />
              <EmailChips
                label="E-mails do cliente"
                value={emailsCliente}
                onChange={setEmailsCliente}
                placeholder="Digite o e-mail e pressione Enter"
                error={fieldErrors.emails_cliente}
              />
              {emailsGrupoBusy && (
                <p className="text-xs text-slate-500">
                  Buscando e-mails de quem já participou de reunião deste grupo…
                </p>
              )}
            </Secao>
            <OutlookDateTimeRange
              inicio={slotInicio}
              fim={slotFim}
              onChange={({ inicio, fim }) => {
                setSlotInicio(inicio);
                setSlotFim(fim);
              }}
              errorInicio={fieldErrors.data_hora_inicio}
              errorFim={fieldErrors.data_hora_fim}
              errorDuracao={fieldErrors.duracao_minutos}
              sala={sala}
              onSalaChange={setSala}
              pessoas={pessoasAgenda}
            />
          </>
        )}

        {!agendarNovo && (
        <Secao icon={Users} titulo="Participantes" destaque="agenda-participantes">
          <ParticipantesPicker
            key={prefillKey || reuniao?.id || "novo"}
            colaboradores={colaboradores}
            usuarios={usuarios}
            defaultSelected={participantesIniciais}
            defaultExternos={externosIniciais}
            error={fieldErrors.participantes}
            onPessoasChange={avisarPessoasAgenda}
          />
          {modoViaB && (
            <EmailChips
              label="E-mails do cliente"
              value={emailsCliente}
              onChange={setEmailsCliente}
              placeholder="Digite o e-mail e pressione Enter"
              error={fieldErrors.emails_cliente}
            />
          )}
        </Secao>
        )}

        {!editing && (
          <>
            <ReunioesAnterioresPanel
              colaboradores={colaboradores}
              clienteId={clienteIdAtual || null}
              exceptId={reuniao?.id}
              incluirPassos={!agendarNovo}
              onTrazerPauta={setPauta}
              onRestaurarPauta={() => setPauta(parsePauta(src?.pauta) ?? pautaVazia())}
              onTrazerPassos={(passos) =>
                setProximosPassos((atual) => mesclarChecklists(atual, passos))
              }
              onRemoverPassos={(passos) =>
                setProximosPassos((atual) => removerDoChecklist(atual, passos))
              }
            />
            <PautaFields value={pauta} onChange={setPauta} />
          </>
        )}
        {editing && secaoAta}
        {!agendarNovo && (
        <ProximosPassosChecklist
          value={proximosPassos}
          onChange={setProximosPassos}
          error={fieldErrors.proximos_passos}
          simples
          colaboradores={colaboradores}
          agendamentosVios={agendamentosVios}
          labelAdornment={
            status === "REALIZADA" && fellowAtivo ? (
              <FellowImportLabelActions
                status={fellowPassosStatus}
                detail={fellowPassosDetail}
                motivo={fellowImportMotivo}
                reserveRefreshSpace
              />
            ) : null
          }
          rodape={
            (podeAgendarVios || tourDestaque === "agenda-passos") && (
              <Button
                type="button"
                size="sm"
                disabled={pending || !podeAgendarVios}
                onClick={() => podeAgendarVios && setViosAberto(true)}
              >
                <Send size={14} />
                Enviar para Agendamento
              </Button>
            )
          }
        />
        )}
        {!editing && secaoAta}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {(viosMsg || src?.vios_envio_status === "erro") && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {viosMsg ?? src?.vios_envio_erro}
          </p>
        )}

        <div className="sticky bottom-0 z-[1] -mx-5 -mb-4 flex items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-5 sm:px-6">
          {podeCancelarEcoa ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || fellowBusy || revertPending}
              onClick={() => {
                focarMotivo.current = true;
                setStatus("CANCELADA");
              }}
            >
              Cancelar reunião
            </Button>
          ) : podeReverterOutlook ? (
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
              {pending
                ? "Salvando..."
                : status === "CANCELADA" && editing
                  ? "Confirmar cancelamento"
                  : modoViaB && !editing
                    ? "Agendar e enviar ao Outlook"
                    : "Salvar"}
            </Button>
          </div>
        </div>
      </form>
      </div>
    </Modal>
    <AgendarViosModal
      open={viosAberto}
      onClose={() => setViosAberto(false)}
      proximosPassos={proximosPassos}
      colaboradores={colaboradores}
      agendamentosVios={agendamentosVios}
      areaPadrao={undefined}
      onEnviar={async (passos) => {
        const r = await enviarReuniaoAoVios(reuniao!.id, passos, proximosPassos);
        if (r.ok) {
          setProximosPassos((atual) =>
            r.proximosPassos ??
            marcarPassosEnviadosVios(
              atual,
              passos.map((p) => p.texto_checklist || p.text)
            )
          );
          setViosRecarregar((n) => n + 1);
        }
        setViosMsg(r.ok ? undefined : r.error ?? "Falha no envio.");
        return r;
      }}
    />
    </>
  );
}
