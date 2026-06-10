"use client";

import { SelectMenu } from "@/components/ui/SelectMenu";

type PessoaOpt = { id: string; nome: string; avatar_url?: string | null };

/**
 * Dropdown de pessoa com avatar — wrapper do SelectMenu.
 * Compatível com FormData (prop `name`) e modo controlado (value + onChange).
 */
export function PersonSelect({
  pessoas,
  name,
  label,
  defaultValue = "",
  value,
  onChange,
  placeholder = "— Selecionar —",
  emptyLabel = "— Nenhum —",
  allowEmpty = true,
  error,
  className,
}: {
  pessoas: PessoaOpt[];
  name?: string;
  label?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <SelectMenu
      options={pessoas.map((p) => ({
        value: p.id,
        label: p.nome,
        avatar: { nome: p.nome, src: p.avatar_url },
      }))}
      name={name}
      label={label}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      emptyOption={allowEmpty ? emptyLabel : undefined}
      error={error}
      className={className}
    />
  );
}
