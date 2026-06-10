"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { ClienteSelect } from "@/components/clientes/ClienteSelect";
import {
  TIPO_REUNIAO,
  MODALIDADE_REUNIAO,
  STATUS_REUNIAO,
} from "@/lib/constants";
import { toDatetimeLocal } from "@/lib/format";
import { validateFields, type FieldErrors } from "@/lib/validate";
import { createReuniao, updateReuniao } from "@/app/(app)/reunioes/actions";
import type { ReuniaoComRelacoes } from "@/types/database";

type PessoaOpt = { id: string; nome: string; avatar_url?: string | null };

export function ReuniaoForm({
  open,
  onClose,
  onSaved,
  reuniao,
  prefill,
  afterCreate,
  pessoas,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reuniao?: ReuniaoComRelacoes | null;
  prefill?: Partial<ReuniaoComRelacoes> | null;
  afterCreate?: (id: string) => Promise<void> | void;
  pessoas: PessoaOpt[];
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

  const participantesIniciais = new Set(
    (src?.participantes ?? []).map((p) => p.pessoa_id)
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

    const errs = validateFields(values, {
      titulo: { required: "Informe o título da reunião." },
      data_hora_inicio: { required: "Informe a data e hora de início." },
      data_hora_fim: {
        afterField: {
          field: "data_hora_inicio",
          message: "O fim deve ser depois do início.",
        },
      },
      duracao_minutos: {
        min: { value: 1, message: "Duração deve ser maior que zero." },
      },
      link_online: { url: "Link inválido — use http(s)://..." },
      gravacao_url: { url: "URL inválida — use http(s)://..." },
      ...(status === "CANCELADA"
        ? {
            motivo_cancelamento: {
              required: "Informe o motivo do cancelamento.",
            },
          }
        : {}),
    });
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
      title={editing ? "Editar reunião" : "Nova reunião externa"}
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

        <div className="grid grid-cols-2 gap-3">
          <SelectMenu
            name="tipo"
            label="Tipo"
            defaultValue={src?.tipo ?? "CAPTACAO"}
            options={Object.entries(TIPO_REUNIAO).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
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
        </div>

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

        <ClienteSelect
          name="cliente_id"
          defaultValue={src?.cliente_id ?? ""}
          defaultLabel={src?.cliente?.nome ?? ""}
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
            label="Fim (opcional)"
            defaultValue={toDatetimeLocal(src?.data_hora_fim)}
            error={fieldErrors.data_hora_fim}
            onChange={autoFillDuracao}
          />
          <Input
            id="duracao_minutos"
            name="duracao_minutos"
            type="number"
            min={0}
            label="Duração (min)"
            placeholder="auto"
            defaultValue={src?.duracao_minutos ?? ""}
            error={fieldErrors.duracao_minutos}
          />
        </div>

        {/* Condicional: ONLINE */}
        {modalidade === "ONLINE" && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <Input
              id="link_online"
              name="link_online"
              label="Link da reunião"
              placeholder="https://teams.microsoft.com/..."
              defaultValue={src?.link_online ?? ""}
              error={fieldErrors.link_online}
            />
            <Input
              id="gravacao_url"
              name="gravacao_url"
              label="URL da gravação"
              defaultValue={src?.gravacao_url ?? ""}
              error={fieldErrors.gravacao_url}
            />
            <Textarea
              id="ata_texto"
              name="ata_texto"
              label="Ata (texto)"
              defaultValue={src?.ata_texto ?? ""}
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

        {/* Participantes */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Participantes internos
          </span>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {pessoas.length === 0 && (
              <p className="px-1 py-2 text-xs text-slate-400">
                Nenhuma pessoa cadastrada.
              </p>
            )}
            {pessoas.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded px-1 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="participantes"
                  value={p.id}
                  defaultChecked={participantesIniciais.has(p.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <Avatar nome={p.nome} src={p.avatar_url} size={22} />
                {p.nome}
              </label>
            ))}
          </div>
        </div>

        <Textarea
          id="tema"
          name="tema"
          label="Tema / pauta (opcional)"
          defaultValue={src?.tema ?? ""}
        />
        {status === "REALIZADA" && (
          <>
            <Textarea
              id="resultado"
              name="resultado"
              label="Resultado (opcional)"
              defaultValue={src?.resultado ?? ""}
            />
            <Textarea
              id="proximos_passos"
              name="proximos_passos"
              label="Próximos passos (opcional)"
              defaultValue={src?.proximos_passos ?? ""}
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
