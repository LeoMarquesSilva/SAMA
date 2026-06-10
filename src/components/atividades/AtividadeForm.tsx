"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { TIPO_ATIVIDADE_INTERNA } from "@/lib/constants";
import { toDatetimeLocal } from "@/lib/format";
import { validateFields, type FieldErrors } from "@/lib/validate";
import {
  createAtividade,
  updateAtividade,
} from "@/app/(app)/atividades/actions";
import type { AtividadeInterna } from "@/types/database";

const TIPOS_COM_QUEM = ["REUNIAO_INTERNA", "REUNIAO_GESTAO", "UM_A_UM"];

export function AtividadeForm({
  open,
  onClose,
  onSaved,
  atividade,
  prefill,
  afterCreate,
  pessoas,
  podeEscolherPessoa,
  pessoaAtualId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  atividade?: AtividadeInterna | null;
  prefill?: Partial<AtividadeInterna> | null;
  afterCreate?: (id: string) => Promise<void> | void;
  pessoas: { id: string; nome: string; avatar_url?: string | null }[];
  podeEscolherPessoa: boolean;
  pessoaAtualId: string | null;
}) {
  const editing = Boolean(atividade);
  const src = atividade ?? prefill ?? null;
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(src?.tipo ?? "DESPACHO");
  const [status, setStatus] = useState(src?.status ?? "REALIZADA");

  const mostraComQuem = TIPOS_COM_QUEM.includes(tipo);

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
      status: String(fd.get("status") ?? ""),
      data_hora_inicio: String(fd.get("data_hora_inicio") ?? ""),
      data_hora_fim: String(fd.get("data_hora_fim") ?? ""),
      duracao_minutos: fd.get("duracao_minutos")
        ? Number(fd.get("duracao_minutos"))
        : undefined,
      descricao: String(fd.get("descricao") ?? ""),
      tema: String(fd.get("tema") ?? ""),
      com_pessoa_id: String(fd.get("com_pessoa_id") ?? ""),
      com_pessoa_nome: String(fd.get("com_pessoa_nome") ?? ""),
      motivo_cancelamento: String(fd.get("motivo_cancelamento") ?? ""),
    };
    const pessoaOverride = podeEscolherPessoa
      ? String(fd.get("pessoa_id") ?? "") || undefined
      : undefined;

    const errs = validateFields(values, {
      titulo: { required: "Informe o título da atividade." },
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
      ...(tipo === "UM_A_UM" && !values.com_pessoa_id && !values.com_pessoa_nome
        ? { com_pessoa_id: { required: "Informe com quem foi o 1:1." } }
        : {}),
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
        ? await updateAtividade(atividade!.id, values, pessoaOverride)
        : await createAtividade(values, pessoaOverride);
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
      title={editing ? "Editar atividade" : "Nova atividade interna"}
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
            value={tipo}
            onChange={(v) => setTipo(v as typeof tipo)}
            options={Object.entries(TIPO_ATIVIDADE_INTERNA).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <SelectMenu
            name="status"
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "REALIZADA", label: "Realizada" },
              { value: "CANCELADA", label: "Cancelada" },
            ]}
          />
        </div>

        {podeEscolherPessoa && (
          <PersonSelect
            name="pessoa_id"
            label="Responsável"
            pessoas={pessoas}
            defaultValue={src?.pessoa_id ?? pessoaAtualId ?? ""}
            allowEmpty={false}
          />
        )}

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

        {mostraComQuem && (
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            <PersonSelect
              name="com_pessoa_id"
              label={tipo === "UM_A_UM" ? "Com quem (obrigatório)" : "Com quem"}
              pessoas={pessoas}
              defaultValue={src?.com_pessoa_id ?? ""}
              error={fieldErrors.com_pessoa_id}
            />
            <Input
              id="com_pessoa_nome"
              name="com_pessoa_nome"
              label="Ou nome livre"
              defaultValue={src?.com_pessoa_nome ?? ""}
            />
          </div>
        )}

        <Textarea
          id="tema"
          name="tema"
          label="Tema (opcional)"
          defaultValue={src?.tema ?? ""}
        />
        <Textarea
          id="descricao"
          name="descricao"
          label="Descrição (opcional)"
          defaultValue={src?.descricao ?? ""}
        />

        {status === "CANCELADA" && (
          <Textarea
            id="motivo_cancelamento"
            name="motivo_cancelamento"
            label="Motivo do cancelamento"
            defaultValue={src?.motivo_cancelamento ?? ""}
            error={fieldErrors.motivo_cancelamento}
          />
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
