import { redirect } from "next/navigation";
import { getPessoaAtual } from "@/lib/currentPessoa";
import type { Pessoa } from "@/types/database";

/** Redireciona para /dashboard se o usuário não for admin. */
export async function requireAdmin(): Promise<Pessoa> {
  const pessoa = await getPessoaAtual();
  if (!pessoa?.is_admin) redirect("/dashboard");
  return pessoa;
}
