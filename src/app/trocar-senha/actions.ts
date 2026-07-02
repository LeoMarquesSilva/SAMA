"use server";

import { createClient } from "@/lib/supabase/server";

export type TrocaSenhaState = { error?: string; redirectTo?: string };

export async function trocarSenha(
  _prev: TrocaSenhaState,
  formData: FormData
): Promise<TrocaSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 6) {
    return { error: "A nova senha deve ter ao menos 6 caracteres." };
  }
  if (senha === "123456") {
    return { error: "Escolha uma senha diferente da padrão (123456)." };
  }
  if (senha !== confirmacao) {
    return { error: "As senhas não conferem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirectTo: "/login" };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  const { error: rpcError } = await supabase.rpc("clear_senha_provisoria");
  if (rpcError) {
    return {
      error:
        "Senha alterada, mas não foi possível concluir a ativação. Contate o administrador.",
    };
  }

  // Encerra a sessão da troca provisória e força login limpo com a senha nova.
  await supabase.auth.signOut();
  return { redirectTo: "/login?senha=alterada" };
}
