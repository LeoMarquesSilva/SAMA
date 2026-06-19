import { redirect } from "next/navigation";
import { getPessoaAtual } from "@/lib/currentPessoa";
import type { Pessoa } from "@/types/database";
import {
  canAccessClientes,
  canAccessRelatorios,
  canAccessTimesheet,
  canAccessUsuarios,
  type NavContext,
} from "@/lib/nav-access";

/** Redireciona para /dashboard se o usuário não for admin. */
export async function requireAdmin(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.is_admin) redirect("/dashboard");
  return pessoa;
}

function navContextFrom(pessoa: Pessoa | null): NavContext {
  return {
    cargo: pessoa?.cargo ?? "COLABORADOR",
    isAdmin: pessoa?.is_admin ?? false,
  };
}

export async function requireUsuariosAccess(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa || !canAccessUsuarios(navContextFrom(pessoa))) {
    redirect("/dashboard");
  }
  return pessoa;
}

export async function requireClientesAccess(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa || !canAccessClientes(navContextFrom(pessoa))) {
    redirect("/dashboard");
  }
  return pessoa;
}

export async function requireRelatoriosAccess(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa || !canAccessRelatorios(navContextFrom(pessoa))) {
    redirect("/dashboard");
  }
  return pessoa;
}

export async function requireTimesheetAccess(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa || !canAccessTimesheet(navContextFrom(pessoa))) {
    redirect("/dashboard");
  }
  return pessoa;
}
