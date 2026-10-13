"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  countEventosPendentes,
  landingPathComOnboarding,
  agendaPendentesQueryOpts,
} from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";
import { countPassosPendentes } from "@/lib/proximos-passos";
import { setAlertasLoginCookie } from "@/lib/alertas-login";
import { variantesEmailEscritorio } from "@/lib/email-escritorio";
import { emailRecuperacaoSenha } from "@/lib/email-recuperacao-senha";
import { outlookConfigurado, sendMail } from "@/lib/graph";
import { urlBaseApp } from "@/lib/app-url";

export type LoginState = { error?: string; redirectTo?: string };

export type RecuperarSenhaState = { error?: string; success?: string };

const MENSAGEM_RECUPERACAO_ENVIADA =
  "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em alguns minutos. Verifique também a caixa de spam.";

/** Pedido repetido dentro desse intervalo não manda outro e-mail. */
const INTERVALO_RECUPERACAO_MS = 60_000;

export async function login(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  // O login pode ter sido criado no outro domínio do escritório (bpplaw ↔
  // bismarchipires): se o digitado não bater, tenta a variante.
  const [digitado, ...outrosDominios] = variantesEmailEscritorio(email);
  let { error } = await supabase.auth.signInWithPassword({ email: digitado, password });
  for (const variante of outrosDominios) {
    if (error?.code !== "invalid_credentials") break;
    ({ error } = await supabase.auth.signInWithPassword({ email: variante, password }));
  }

  if (error) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não foi possível validar a sessão." };
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, ativo, senha_provisoria, cargo, departamento, is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!perfil) {
    await supabase.auth.signOut();
    return {
      error:
        "Seu login não está vinculado a um usuário do SAMA. Peça ao administrador para ativar seu acesso.",
    };
  }

  if (!perfil.ativo) {
    await supabase.auth.signOut();
    return {
      error:
        "Seu acesso está desativado. Peça ao administrador para reativar seu login.",
    };
  }

  if (perfil.senha_provisoria) {
    return { redirectTo: "/trocar-senha" };
  }

  // A sincronização do Outlook não roda mais no login (era bloqueante).
  // Ela acontece ao abrir a tela do calendário (CalendarioAutoSync, throttle 5 min).
  const pendentes = await countEventosPendentes(
    supabase,
    agendaPendentesQueryOpts(perfil)
  );
  const passosPendentes = await countPassosPendentes(supabase, {
    pessoaId: perfil.id,
  });

  if (pendentes > 0 || passosPendentes > 0) {
    await setAlertasLoginCookie();
  }

  const onboarding = await getOnboardingFlags(supabase, user.id);

  return {
    redirectTo: landingPathComOnboarding({
      cargo: perfil.cargo,
      pendentes,
      onboardingCalendarioConcluido: onboarding.calendarioConcluido,
    }),
  };
}

export async function solicitarRecuperacaoSenha(
  _prev: RecuperarSenhaState,
  formData: FormData
): Promise<RecuperarSenhaState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    return { error: "Informe seu e-mail corporativo." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !outlookConfigurado()) {
    return {
      error:
        "Recuperação de senha indisponível no momento. Contate o administrador.",
    };
  }

  // O cadastro pode estar no outro domínio do escritório (bpplaw ↔ bismarchipires).
  const admin = createAdminClient();
  const { data: pessoas } = await admin
    .from("usuarios")
    .select("email, ativo, auth_user_id")
    .or(variantesEmailEscritorio(email).map((e) => `email.ilike.${e}`).join(","))
    .limit(5);
  const pessoa = pessoas?.find((p) => p.ativo && p.auth_user_id);

  // Mesma resposta para quem não tem acesso: não revela quais e-mails existem.
  if (!pessoa?.auth_user_id) {
    return { success: MENSAGEM_RECUPERACAO_ENVIADA };
  }

  try {
    const { data: conta } = await admin.auth.admin.getUserById(pessoa.auth_user_id);
    const emailLogin = conta.user?.email;
    if (!emailLogin) return { success: MENSAGEM_RECUPERACAO_ENVIADA };

    const ultimo = conta.user?.recovery_sent_at ? Date.parse(conta.user.recovery_sent_at) : 0;
    if (Date.now() - ultimo < INTERVALO_RECUPERACAO_MS) {
      return { success: MENSAGEM_RECUPERACAO_ENVIADA };
    }

    // O link é gerado aqui e o e-mail sai pelo Graph. O token só é usado quando
    // a pessoa salva a nova senha: abre em qualquer navegador e o antivírus de
    // links do Outlook não consegue gastá-lo antes.
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: emailLogin,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (error || !tokenHash) {
      console.error("[recuperar-senha] generateLink:", error?.message);
      return { success: MENSAGEM_RECUPERACAO_ENVIADA };
    }

    const url = `${urlBaseApp()}/redefinir-senha?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
    await sendMail({
      // Sem caixa própria configurada, sai da caixa da própria pessoa (a mesma
      // que o SAMA já usa para pauta e ata) e não fica nos Itens Enviados.
      remetenteEmail: process.env.SAMA_EMAIL_REMETENTE?.trim() || pessoa.email,
      assunto: "Redefinir senha do SAMA",
      corpoHtml: emailRecuperacaoSenha(url),
      para: [emailLogin],
      salvarEnviados: false,
    });
  } catch (err) {
    console.error(
      "[recuperar-senha]",
      err instanceof Error ? err.message : String(err)
    );
  }

  return { success: MENSAGEM_RECUPERACAO_ENVIADA };
}
