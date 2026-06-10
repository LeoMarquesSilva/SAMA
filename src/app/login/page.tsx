"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Target } from "lucide-react";
import { login, type LoginState } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  const searchParams = useSearchParams();
  const inativo = searchParams.get("erro") === "inativo";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Target size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">SAMA</h1>
          <p className="text-sm text-slate-500">
            Metas &amp; Atividades dos Sócios
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Input
            id="email"
            name="email"
            type="email"
            label="E-mail"
            placeholder="voce@empresa.com"
            autoComplete="email"
            required
          />
          <Input
            id="password"
            name="password"
            type="password"
            label="Senha"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          {inativo && !state.error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Seu acesso está desativado. Peça ao administrador para reativar seu
              login.
            </p>
          )}
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}
          <SubmitButton />
        </form>
      </div>
    </main>
  );
}
