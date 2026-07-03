"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  login,
  solicitarRecuperacaoSenha,
  type LoginState,
  type RecuperarSenhaState,
} from "@/app/login/actions";

function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm shadow-brand-600/20 transition-all hover:shadow-md hover:shadow-brand-600/25"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Entrando...
        </>
      ) : (
        "Entrar no sistema"
      )}
    </Button>
  );
}

function RecuperarSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm shadow-brand-600/20 transition-all hover:shadow-md hover:shadow-brand-600/25"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden />
          Enviando...
        </>
      ) : (
        "Enviar link de recuperação"
      )}
    </Button>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-slate-700"
    >
      {children}
    </label>
  );
}

function FieldShell({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Icon
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

export function LoginFormPanel() {
  const router = useRouter();
  const [loginState, loginAction] = useActionState<LoginState, FormData>(login, {});
  const [recuperarState, recuperarAction] = useActionState<
    RecuperarSenhaState,
    FormData
  >(solicitarRecuperacaoSenha, {});
  const searchParams = useSearchParams();
  const inativo = searchParams.get("erro") === "inativo";
  const recuperacaoInvalida = searchParams.get("erro") === "recuperacao";
  const senhaAlterada = searchParams.get("senha") === "alterada";
  const [showPassword, setShowPassword] = useState(false);
  const [modo, setModo] = useState<"login" | "recuperar">("login");

  useEffect(() => {
    if (loginState.redirectTo) router.replace(loginState.redirectTo);
  }, [loginState.redirectTo, router]);

  const inputClass = clsx(
    "w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-11 text-sm text-slate-800 shadow-sm transition",
    "placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
  );

  if (modo === "recuperar") {
    return (
      <section className="flex flex-1 flex-col justify-center bg-slate-50/80 px-5 py-8 sm:px-10 sm:py-12 lg:min-h-[100dvh] lg:bg-white lg:px-12 lg:py-14 xl:px-16">
        <div
          className="login-fade-up mx-auto w-full max-w-[420px]"
          style={{ animationDelay: "0.08s" }}
        >
          <button
            type="button"
            onClick={() => setModo("login")}
            className="login-fade-up mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-600"
            style={{ animationDelay: "0.1s" }}
          >
            <ArrowLeft size={16} aria-hidden />
            Voltar ao login
          </button>

          <div className="login-fade-up" style={{ animationDelay: "0.14s" }}>
            <h1 className="font-[family-name:var(--font-login-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Esqueci minha senha
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Informe seu e-mail corporativo. Enviaremos um link para você criar
              uma senha nova.
            </p>
          </div>

          <form
            action={recuperarAction}
            className="login-fade-up mt-8 space-y-5"
            style={{ animationDelay: "0.2s" }}
          >
            <FieldShell id="recuperar-email" label="E-mail" icon={Mail}>
              <input
                id="recuperar-email"
                name="email"
                type="email"
                placeholder="voce@empresa.com"
                autoComplete="email"
                required
                className={inputClass}
              />
            </FieldShell>

            {recuperarState.success && (
              <div
                role="status"
                className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <p>{recuperarState.success}</p>
              </div>
            )}

            {recuperarState.error && (
              <div
                role="alert"
                className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p>{recuperarState.error}</p>
              </div>
            )}

            <RecuperarSubmitButton />
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col justify-center bg-slate-50/80 px-5 py-8 sm:px-10 sm:py-12 lg:min-h-[100dvh] lg:bg-white lg:px-12 lg:py-14 xl:px-16">
      <div
        className="login-fade-up mx-auto w-full max-w-[420px]"
        style={{ animationDelay: "0.08s" }}
      >
        <div className="login-fade-up" style={{ animationDelay: "0.14s" }}>
          <h1 className="font-[family-name:var(--font-login-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Entre com suas credenciais corporativas para acessar o painel.
          </p>
        </div>

        <form
          action={loginAction}
          className="login-fade-up mt-8 space-y-5"
          style={{ animationDelay: "0.2s" }}
        >
          <FieldShell id="email" label="E-mail" icon={Mail}>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="voce@empresa.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </FieldShell>

          <div className="space-y-1.5">
            <FieldShell id="password" label="Senha" icon={Lock}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
                className={clsx(inputClass, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </FieldShell>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setModo("recuperar")}
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700 hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </div>

          {senhaAlterada && !loginState.error && (
            <div
              role="status"
              className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <p>
                Senha definida com sucesso. Entre novamente com a nova senha.
              </p>
            </div>
          )}

          {recuperacaoInvalida && !loginState.error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                O link de recuperação expirou ou é inválido. Solicite um novo
                e-mail em &quot;Esqueci minha senha&quot;.
              </p>
            </div>
          )}

          {inativo && !loginState.error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                Seu acesso está desativado. Peça ao administrador para reativar
                seu login.
              </p>
            </div>
          )}

          {loginState.error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p>{loginState.error}</p>
            </div>
          )}

          <LoginSubmitButton />
        </form>

        <p
          className="login-fade-up mt-8 text-center text-xs text-slate-400 lg:text-left"
          style={{ animationDelay: "0.28s" }}
        >
          Problemas para entrar? Use &quot;Esqueci minha senha&quot; ou contate o
          administrador.
        </p>
      </div>
    </section>
  );
}
