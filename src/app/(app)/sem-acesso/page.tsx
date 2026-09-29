import { Lock } from "lucide-react";

export default function SemAcessoPage() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Lock size={22} />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-slate-800">Nenhum módulo liberado</h1>
      <p className="mt-2 text-sm text-slate-500">
        Seu usuário ainda não tem acesso a nenhum módulo do SAMA. Peça a um administrador
        para liberar os módulos que você precisa.
      </p>
    </div>
  );
}
