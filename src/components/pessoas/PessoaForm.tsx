"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { CARGO_PESSOA, departamentoUsuarioOptions } from "@/lib/constants";
import { validateFields, type FieldErrors } from "@/lib/validate";
import { createPessoa, updatePessoa } from "@/app/(app)/pessoas/actions";
import type { Pessoa } from "@/types/database";

export function PessoaForm({
  open,
  onClose,
  onSaved,
  pessoa,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  pessoa?: Pessoa | null;
}) {
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const editing = Boolean(pessoa);

  const departamentoOptions = useMemo(() => {
    const opts = departamentoUsuarioOptions();
    const atual = pessoa?.departamento?.trim();
    if (atual && !opts.some((o) => o.value === atual)) {
      opts.push({ value: atual, label: `${atual} (atual)` });
    }
    return opts;
  }, [pessoa?.departamento]);

  function handleSubmit(formData: FormData) {
    setError(undefined);
    const errs = validateFields(
      {
        nome: formData.get("nome"),
        email: formData.get("email"),
        departamento: formData.get("departamento"),
      },
      {
        nome: { required: "Informe o nome." },
        email: {
          required: "Informe o e-mail.",
          email: "E-mail inválido — ex.: nome@bismarchipires.com.br",
        },
        departamento: { required: "Selecione um departamento." },
      }
    );
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    startTransition(async () => {
      const result = editing
        ? await updatePessoa(pessoa!.id, formData)
        : await createPessoa(formData);
      if (result.ok) {
        onSaved();
        onClose();
      } else {
        setError(result.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar pessoa" : "Nova pessoa"}
    >
      <form action={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          id="nome"
          name="nome"
          label="Nome"
          defaultValue={pessoa?.nome}
          error={fieldErrors.nome}
          required
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="E-mail"
          defaultValue={pessoa?.email}
          error={fieldErrors.email}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectMenu
            name="cargo"
            label="Cargo"
            defaultValue={pessoa?.cargo ?? "COLABORADOR"}
            options={Object.entries(CARGO_PESSOA).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <SelectMenu
            name="departamento"
            label="Departamento"
            placeholder="Selecionar departamento"
            defaultValue={pessoa?.departamento ?? ""}
            options={departamentoOptions}
            error={fieldErrors.departamento}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_admin"
            defaultChecked={pessoa?.is_admin ?? false}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Acesso total ao sistema (administrador)
        </label>
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-600">Sócio</span> sempre tem
          acesso total. Demais cargos veem só os próprios dados, salvo se
          marcado acima.
        </p>
        <p className="text-xs text-slate-400">
          A ativação do login (com senha padrão) é feita pelo botão{" "}
          <span className="font-medium">Ativar</span> na listagem.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
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
