"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { isAdminCargo } from "@/lib/constants";
import { pessoaSchema } from "@/lib/validations";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";

export type ActionResult = { ok: boolean; error?: string };

const SENHA_PADRAO = "123456";

function parse(formData: FormData) {
  return pessoaSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    cargo: formData.get("cargo"),
    departamento: formData.get("departamento"),
    is_admin:
      formData.get("is_admin") === "on" || formData.get("is_admin") === "true",
  });
}

function resolveIsAdmin(cargo: "SOCIO" | "SOCIO_AREA" | "COLABORADOR", isAdmin: boolean) {
  return isAdminCargo(cargo) || isAdmin;
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    const match = data.users.find(
      (u) => u.email && emailsEscritorioIguais(u.email, email)
    );
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function createPessoa(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").insert({
    nome: parsed.data.nome,
    email: parsed.data.email,
    cargo: parsed.data.cargo,
    departamento: parsed.data.departamento ?? null,
    is_admin: resolveIsAdmin(parsed.data.cargo, parsed.data.is_admin),
    ativo: false, // novas pessoas começam desativadas (sem login)
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe uma pessoa com este e-mail."
          : "Erro ao salvar pessoa.",
    };
  }

  revalidatePath("/pessoas");
  return { ok: true };
}

export async function updatePessoa(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("usuarios")
    .update({
      nome: parsed.data.nome,
      email: parsed.data.email,
      cargo: parsed.data.cargo,
      departamento: parsed.data.departamento ?? null,
      is_admin: resolveIsAdmin(parsed.data.cargo, parsed.data.is_admin),
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe uma pessoa com este e-mail."
          : "Erro ao atualizar pessoa.",
    };
  }

  revalidatePath("/pessoas");
  return { ok: true };
}

export async function deletePessoa(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").delete().eq("id", id);
  if (error) return { ok: false, error: "Erro ao excluir pessoa." };
  revalidatePath("/pessoas");
  return { ok: true };
}

/**
 * Ativa a pessoa: cria o usuário de login no Supabase Auth com a senha padrão
 * (123456) e exige troca no primeiro acesso (senha_provisoria = true).
 */
export async function ativarPessoa(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local — necessária para criar o login.",
    };
  }

  const supabase = await createClient();
  const { data: pessoa, error: fetchError } = await supabase
    .from("usuarios")
    .select("id, email, nome, auth_user_id, ativo")
    .eq("id", id)
    .single();

  if (fetchError || !pessoa) {
    return { ok: false, error: "Pessoa não encontrada." };
  }

  const admin = createAdminClient();
  let authUserId = pessoa.auth_user_id as string | null;

  if (!authUserId) {
    // Cria o usuário de auth com senha padrão e e-mail já confirmado.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: pessoa.email,
        password: SENHA_PADRAO,
        email_confirm: true,
        user_metadata: { nome: pessoa.nome },
      });

    if (createError || !created.user) {
      const recovered = await findAuthUserByEmail(admin, pessoa.email);
      if (!recovered) {
        return {
          ok: false,
          error: `Erro ao criar login: ${createError?.message ?? "desconhecido"}`,
        };
      }
      authUserId = recovered;
    } else {
      authUserId = created.user.id;
    }
  } else {
    // Já existia login: reseta para a senha padrão.
    await admin.auth.admin.updateUserById(authUserId, {
      password: SENHA_PADRAO,
    });
  }

  const { error: updateError } = await supabase
    .from("usuarios")
    .update({ ativo: true, senha_provisoria: true, auth_user_id: authUserId })
    .eq("id", id);

  if (updateError) {
    return { ok: false, error: "Login criado, mas falhou ao ativar a pessoa." };
  }

  revalidatePath("/pessoas");
  return { ok: true };
}

/**
 * Desativa a pessoa: remove o usuário de login (bloqueando o acesso) e
 * mantém o cadastro de domínio.
 */
export async function desativarPessoa(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: pessoa } = await supabase
    .from("usuarios")
    .select("auth_user_id")
    .eq("id", id)
    .single();

  if (pessoa?.auth_user_id) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY não configurada no .env.local.",
      };
    }
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(pessoa.auth_user_id);
  }

  const { error } = await supabase
    .from("usuarios")
    .update({ ativo: false, senha_provisoria: false, auth_user_id: null })
    .eq("id", id);

  if (error) return { ok: false, error: "Erro ao desativar pessoa." };

  revalidatePath("/pessoas");
  return { ok: true };
}
