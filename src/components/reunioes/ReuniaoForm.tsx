"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
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
  type TipoReuniaoKey,
} from "@/lib/constants";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { TipoReuniao } from "@/types/database";
import { toDatetimeLocal } from "@/lib/format";
import { validateFields, type FieldErrors } from "@/lib/validate";
import {
  buscarConteudoFellow,
  createReuniao,
  updateReuniao,
} from "@/app/(app)/reunioes/actions";
import { resolverClienteVios, sugerirClientePorTituloReuniao } from "@/app/(app)/clientes/actions";
import type { ClienteBusca } from "@/app/(app)/clientes/actions";
import type { ReuniaoComRelacoes } from "@/types/database";
import { labelGrupoCliente } from "@/lib/clientes";
import { Download } from "lucide-react";
import { ProximosPassosChecklist } from "@/components/reunioes/ProximosPassosChecklist";
import { checklistTemItens } from "@/lib/proximos-passos-checklist";

type ClientePrefill = {
  ci: string;
  nome: string;
  grupo: string | null;
  kind: "grupo" | "empresa";
};

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
  fellowAtivo = false,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reuniao?: ReuniaoComRelacoes | null;
  prefill?: Partial<ReuniaoComRelacoes> | null;
  afterCreate?: (id: string) => Promise<void> | void;
  colaboradores: ColaboradorOpt[];
  fellowAtivo?: boolean;
}) {
  const editing = Boolean(reuniao);
  const src = reuniao ?? prefill ?? null;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [fellowPending, startFellowTransition] = useTransition();
  const [fellowMsg, setFellowMsg] = useState<string>();
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

  const participantesIniciais = (src?.participantes ?? []).map(
    (p) => p.colaborador_id
  );

  const prefillKey = [
    prefill?.outlook_event_id,
    prefill?.titulo,
    prefill?.data_hora_inicio,
  ].join("|");

  useEffect(() => {
    if (!open) {
      setFellowMsg(undefined);
      return;
    }
    setResultadoTexto(src?.resultado ?? "");
    setProximosPassos(src?.proximos_passos ?? "");
    if (prefill?.modalidade) setModalidade(prefill.modalidade);
    if (prefill?.status) setStatus(prefill.status);
  }, [open, prefillKey, reuniao?.id, src?.resultado, src?.proximos_passos, prefill?.modalidade, prefill?.status]);

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
    if (clienteManualRef.current) return;
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

  useEffect(() => {
    if (!open) return;

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
      tema: String(fd.get("tema") ?? ""),
      objetivos: String(fd.get("objetivos") ?? ""),
      resultado: String(fd.get("resultado") ?? ""),
      proximos_passos: String(fd.get("proximos_passos") ?? ""),
      motivo_cancelamento: String(fd.get("motivo_cancelamento") ?? ""),
      participantes: fd.getAll("participantes").map(String),
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
        tema: { required: "Informe o tema / pauta." },
        link_online: { url: "Link inválido — use http(s)://..." },
        ...(modalidade === "PRESENCIAL_EXTERNO"
          ? { local: { required: "Informe o local." } }
          : {}),
        ...(status === "REALIZADA"
          ? {
              resultado: { required: "Informe o resumo." },
              proximos_passos: { required: "Informe os próximos passos." },
            }
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

    if (values.participantes.length === 0) {
      errs.participantes = "Selecione ao menos um participante.";
    }

    if (status === "REALIZADA" && !checklistTemItens(values.proximos_passos)) {
      errs.proximos_passos = "Informe ao menos um próximo passo.";
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      const r = editing
        ? await updateReuniao(reuniao!.id, values)
        : await createReuniao(values);
      if (r.ok) {
        if (!editing && r.id && afterCreate) await afterCreate(r.id);
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
    if (!r.ok) {
      setFellowMsg(r.error ?? "Não foi possível importar do Fellow.");
      return;
    }

    if (r.resultado) setResultadoTexto(r.resultado);
    if (r.proximos_passos) setProximosPassos(r.proximos_passos);

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
    if (!open || editing || !fellowAtivo || !prefill) return;
    if (prefill.modalidade !== "ONLINE") return;

    let cancelled = false;
    startFellowTransition(async () => {
      setFellowMsg(undefined);
      const r = await buscarConteudoFellow({
        outlook_event_id: prefill.outlook_event_id,
        titulo: prefill.titulo,
        data_hora_inicio: prefill.data_hora_inicio,
      });
      if (!cancelled) aplicarFellow(r, "auto");
    });

    return () => {
      cancelled = true;
    };
  }, [open, editing, fellowAtivo, prefillKey, prefill?.modalidade]);

  function handleImportarFellow() {
    setFellowMsg(undefined);
    startFellowTransition(async () => {
      const r = await buscarConteudoFellow(parametrosFellow());
      aplicarFellow(r, "manual");
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar Reclassificação Reunião" : "Reclassificação Reunião"}
      size="xl"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          id="titulo"
          name="titulo"
          label="Título"
          ref={tituloRef}
          defaultValue={src?.titulo}
          onChange={handleTituloChange}
          error={fieldErrors.titulo}
          required
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Tipo
              <InfoTooltip text={TIPO_REUNIAO_DESCRICAO[tipo as TipoReuniaoKey]} />
            </span>
            <SelectMenu
              name="tipo"
              value={tipo}
              onChange={(v) => setTipo(v as TipoReuniao)}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            id="data_hora_inicio"
            name="data_hora_inicio"
            type="datetime-local"
            label="Início"
            ref={inicioRef}
            defaultValue={toDatetimeLocal(src?.data_hora_inicio)}
            error={fieldErrors.data_hora_inicio}
            onChange={autoFillDuracao}
            required
          />
          <Input
            id="data_hora_fim"
            name="data_hora_fim"
            type="datetime-local"
            label="Fim"
            defaultValue={toDatetimeLocal(src?.data_hora_fim)}
            error={fieldErrors.data_hora_fim}
            onChange={autoFillDuracao}
            required
          />
          <Input
            id="duracao_minutos"
            name="duracao_minutos"
            type="number"
            min={1}
            label="Duração (min)"
            defaultValue={src?.duracao_minutos ?? ""}
            error={fieldErrors.duracao_minutos}
            required
          />
        </div>

        {status === "REALIZADA" && (
          <>
            <Textarea
              id="resultado"
              name="resultado"
              label="Resumo"
              value={resultadoTexto}
              onChange={(e) => setResultadoTexto(e.target.value)}
              error={fieldErrors.resultado}
              required
            />
            <ProximosPassosChecklist
              value={proximosPassos}
              onChange={setProximosPassos}
              error={fieldErrors.proximos_passos}
              required
            />
          </>
        )}

        {/* Condicional: PRESENCIAL EXTERNO */}
        {modalidade === "PRESENCIAL_EXTERNO" && (
          <Input
            id="local"
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
            id="motivo_cancelamento"
            name="motivo_cancelamento"
            label="Motivo do cancelamento"
            defaultValue={src?.motivo_cancelamento ?? ""}
            error={fieldErrors.motivo_cancelamento}
            required
          />
        )}

        <ParticipantesPicker
          colaboradores={colaboradores}
          defaultSelected={participantesIniciais}
          error={fieldErrors.participantes}
        />

        <Textarea
          id="tema"
          name="tema"
          label="Tema / pauta"
          defaultValue={src?.tema ?? ""}
          error={fieldErrors.tema}
          required
        />

        {modalidade === "ONLINE" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            {fellowAtivo && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  {prefill && !editing
                    ? "Ao abrir, o SAMA busca resumo e ações no Fellow."
                    : "Importa resumo e ações da gravação Fellow vinculada ao evento do Outlook."}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={fellowPending}
                  onClick={handleImportarFellow}
                >
                  <Download size={14} />
                  {fellowPending ? "Buscando..." : "Buscar novamente"}
                </Button>
              </div>
            )}
            {fellowPending && !fellowMsg && (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                Buscando conteúdo no Fellow…
              </p>
            )}
            {fellowMsg && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                {fellowMsg}
              </p>
            )}
            <Input
              id="link_online"
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

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
