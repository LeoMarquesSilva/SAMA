"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
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
import { createReuniao, updateReuniao } from "@/app/(app)/reunioes/actions";
import type { ReuniaoComRelacoes } from "@/types/database";

export function ReuniaoForm({
  open,
  onClose,
  onSaved,
  reuniao,
  prefill,
  afterCreate,
  colaboradores,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reuniao?: ReuniaoComRelacoes | null;
  prefill?: Partial<ReuniaoComRelacoes> | null;
  afterCreate?: (id: string) => Promise<void> | void;
  colaboradores: ColaboradorOpt[];
}) {
  const editing = Boolean(reuniao);
  const src = reuniao ?? prefill ?? null;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [modalidade, setModalidade] = useState(
    src?.modalidade ?? "PRESENCIAL_ESCRITORIO"
  );
  const [status, setStatus] = useState(src?.status ?? "AGENDADA");
  const [tipo, setTipo] = useState<TipoReuniao>(src?.tipo ?? "CAPTACAO");

  const participantesIniciais = (src?.participantes ?? []).map(
    (p) => p.colaborador_id
  );

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
      gravacao_url: String(fd.get("gravacao_url") ?? ""),
      ata_texto: String(fd.get("ata_texto") ?? ""),
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
        gravacao_url: { url: "URL inválida — use http(s)://..." },
        ...(modalidade === "PRESENCIAL_EXTERNO"
          ? { local: { required: "Informe o local." } }
          : {}),
        ...(modalidade === "ONLINE"
          ? { ata_texto: { required: "Informe a ata." } }
          : {}),
        ...(status === "REALIZADA"
          ? {
              resultado: { required: "Informe o resultado." },
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
          defaultValue={src?.titulo}
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
          defaultValue={src?.cliente_id ?? ""}
          defaultLabel={src?.cliente?.nome ?? ""}
          error={fieldErrors.cliente_id}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            id="data_hora_inicio"
            name="data_hora_inicio"
            type="datetime-local"
            label="Início"
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

        {/* Condicional: ONLINE */}
        {modalidade === "ONLINE" && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <Input
              id="link_online"
              name="link_online"
              label="Link da reunião (opcional)"
              placeholder="https://teams.microsoft.com/..."
              defaultValue={src?.link_online ?? ""}
              error={fieldErrors.link_online}
            />
            <Input
              id="gravacao_url"
              name="gravacao_url"
              label="URL da gravação (opcional)"
              defaultValue={src?.gravacao_url ?? ""}
              error={fieldErrors.gravacao_url}
            />
            <Textarea
              id="ata_texto"
              name="ata_texto"
              label="Ata (texto)"
              defaultValue={src?.ata_texto ?? ""}
              error={fieldErrors.ata_texto}
              required
            />
          </div>
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
        {status === "REALIZADA" && (
          <>
            <Textarea
              id="resultado"
              name="resultado"
              label="Resultado"
              defaultValue={src?.resultado ?? ""}
              error={fieldErrors.resultado}
              required
            />
            <Textarea
              id="proximos_passos"
              name="proximos_passos"
              label="Próximos passos"
              defaultValue={src?.proximos_passos ?? ""}
              error={fieldErrors.proximos_passos}
              required
            />
          </>
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
