// Validações de formulário no cliente — mensagens em pt-BR, por campo.

import { datetimeLocalSpToMs } from "@/lib/datetime-br";

export type FieldErrors = Record<string, string>;

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type Rule = {
  required?: string;
  email?: string;
  url?: string;
  /** Data/hora que deve ser posterior ao valor de outro campo. */
  afterField?: { field: string; message: string };
  min?: { value: number; message: string };
};

/**
 * Valida um objeto de valores contra regras simples por campo.
 * Campos vazios só falham se tiverem `required`; as demais regras
 * rodam apenas quando o campo está preenchido.
 */
export function validateFields(
  values: Record<string, unknown>,
  rules: Record<string, Rule>
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const raw = values[field];
    const str = raw == null ? "" : String(raw).trim();

    if (rule.required && !str) {
      errors[field] = rule.required;
      continue;
    }
    if (!str) continue;

    if (rule.email && !isEmail(str)) {
      errors[field] = rule.email;
      continue;
    }
    if (rule.url && !isUrl(str)) {
      errors[field] = rule.url;
      continue;
    }
    if (rule.afterField) {
      const other = values[rule.afterField.field];
      const otherStr = other == null ? "" : String(other).trim();
      const aMs = datetimeLocalSpToMs(str);
      const bMs = datetimeLocalSpToMs(otherStr);
      if (otherStr && aMs != null && bMs != null && aMs <= bMs) {
        errors[field] = rule.afterField.message;
        continue;
      }
    }
    if (rule.min && Number(str) < rule.min.value) {
      errors[field] = rule.min.message;
    }
  }
  return errors;
}
