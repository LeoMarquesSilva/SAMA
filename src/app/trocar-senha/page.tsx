"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound } from "lucide-react";
import { trocarSenha, type TrocaSenhaState } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Salvando..." : "Definir nova senha"}
    </Button>
  );
}

export default function TrocarSenhaPage() {
  const [state, formAction] = useActionState<TrocaSenhaState, FormData>(
    trocarSenha,
    {}
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <KeyRound size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Trocar senha</h1>
          <p className="text-sm text-slate-500">
            Por segurança, defina uma nova senha para continuar.
          </p>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <Input
            id="senha"
            name="senha"
            type="password"
            label="Nova senha"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            required
          />
          <Input
            id="confirmacao"
            name="confirmacao"
            type="password"
            label="Confirmar nova senha"
            autoComplete="new-password"
            required
          />
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
