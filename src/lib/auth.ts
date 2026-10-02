import { redirect } from "next/navigation";
import { getModulosAtuais, getPessoaAtual } from "@/lib/currentPessoa";
import type { Pessoa } from "@/types/database";
import { primeiraRotaLiberada, temModulo, type ModuloKey } from "@/lib/modulos";

/** Redireciona para /dashboard se o usuário não for admin. */
export async function requireAdmin(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.is_admin) redirect("/dashboard");
  return pessoa;
}

/** Exige o módulo liberado (admins sempre passam); senão manda para o primeiro módulo liberado. */
export async function requireModulo(modulo: ModuloKey): Promise<Pessoa> {
  const [pessoa, modulos] = await Promise.all([getPessoaAtual(), getModulosAtuais()]);
  if (!pessoa) redirect("/login");
  const ctx = { isAdmin: pessoa.is_admin, modulos };
  if (!temModulo(ctx, modulo)) {
    redirect(primeiraRotaLiberada(ctx) ?? "/sem-acesso");
  }
  return pessoa;
}

export function requireUsuariosAccess(): Promise<Pessoa> {
  return requireModulo("usuarios");
}

export function requireClientesAccess(): Promise<Pessoa> {
  return requireModulo("clientes");
}

export function requireRelatoriosAccess(): Promise<Pessoa> {
  return requireModulo("relatorios");
}

export function requireTimesheetAccess(): Promise<Pessoa> {
  return requireModulo("timesheet");
}

export function requireConfiguracoesAccess(): Promise<Pessoa> {
  return requireModulo("configuracoes");
}
