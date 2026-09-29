"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { pessoaSchema } from "@/lib/validations";
import { emailsEscritorioIguais } from "@/lib/email-escritorio";
import { isModuloKey } from "@/lib/modulos";
import { departamentoCanonico } from "@/lib/constants";
import { sincronizarColaboradores } from "@/lib/colaboradores";
import type { ResultadoSyncColaboradores } from "@/lib/colaboradores-sync";

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
    is_admin: parsed.data.is_admin,
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
      is_admin: parsed.data.is_admin,
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
    .update({
      ativo: true,
      senha_provisoria: true,
      auth_user_id: authUserId,
      onboarding_calendario_concluido: false,
      onboarding_dashboard_concluido: false,
      onboarding_proximos_passos_concluido: false,
      onboarding_agendamento_concluido: false,
    })
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

/** Define exatamente quais módulos a pessoa pode acessar. */
export async function salvarModulosUsuario(
  usuarioId: string,
  modulos: string[]
): Promise<ActionResult> {
  const eu = await requireAdmin();
  const desejados = new Set(modulos.filter(isModuloKey));
  const supabase = await createClient();

  const { data: atuais, error: lerErr } = await supabase
    .from("usuario_modulos")
    .select("modulo")
    .eq("usuario_id", usuarioId);
  if (lerErr) return { ok: false, error: "Erro ao ler os módulos atuais." };

  const atuaisSet = new Set((atuais ?? []).map((m) => m.modulo as string));
  const remover = [...atuaisSet].filter((m) => !desejados.has(m as never));
  const adicionar = [...desejados].filter((m) => !atuaisSet.has(m));

  if (remover.length > 0) {
    const { error } = await supabase
      .from("usuario_modulos")
      .delete()
      .eq("usuario_id", usuarioId)
      .in("modulo", remover);
    if (error) return { ok: false, error: "Erro ao remover módulos." };
  }
  if (adicionar.length > 0) {
    const { error } = await supabase.from("usuario_modulos").insert(
      adicionar.map((modulo) => ({ usuario_id: usuarioId, modulo, liberado_por: eu.id }))
    );
    if (error) return { ok: false, error: "Erro ao liberar módulos." };
  }

  revalidatePath("/pessoas");
  return { ok: true };
}

/**
 * Cria o cadastro no SAMA a partir do colaborador sincronizado e já ativa o
 * login (senha padrão). Os módulos padrão vêm do gatilho de usuarios.
 */
export async function darAcessoColaborador(colaboradorId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: colab } = await admin
    .from("colaboradores")
    .select("id, nome, email, departamento, ativo")
    .eq("id", colaboradorId)
    .single();
  if (!colab) return { ok: false, error: "Colaborador não encontrado." };
  if (!colab.ativo) return { ok: false, error: "Colaborador desligado no ORQESTRAI." };

  const { data: usuarios } = await admin.from("usuarios").select("id, email");
  const existente = (usuarios ?? []).find((u) => emailsEscritorioIguais(u.email, colab.email));

  let usuarioId = existente?.id as string | undefined;
  if (!usuarioId) {
    const { data: novo, error } = await admin
      .from("usuarios")
      .insert({
        nome: colab.nome,
        email: colab.email,
        cargo: "COLABORADOR",
        departamento: departamentoCanonico(colab.departamento) ?? "Geral",
        is_admin: false,
        ativo: false,
      })
      .select("id")
      .single();
    if (error || !novo) return { ok: false, error: "Erro ao criar o cadastro da pessoa." };
    usuarioId = novo.id as string;
  }

  await admin.from("colaboradores").update({ usuario_id: usuarioId }).eq("id", colab.id);
  return ativarPessoa(usuarioId);
}

/** Atualiza colaboradores a partir do ORQESTRAI (e Responsum, se configurado). */
export async function atualizarColaboradores(): Promise<ResultadoSyncColaboradores> {
  await requireAdmin();
  const r = await sincronizarColaboradores();
  revalidatePath("/pessoas");
  return r;
}

export async function ativarPendentes(): Promise<
  ActionResult & { ativados?: number }
> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("ativo", false);
  const ids = (data ?? []).map((p) => p.id);
  let ativados = 0;
  for (const id of ids) {
    const r = await ativarPessoa(id);
    if (r.ok) ativados += 1;
  }
  revalidatePath("/pessoas");
  return {
    ok: ativados > 0 || ids.length === 0,
    ativados,
    error:
      ids.length > 0 && ativados === 0
        ? "Nenhum login pôde ser ativado."
        : undefined,
  };
}
