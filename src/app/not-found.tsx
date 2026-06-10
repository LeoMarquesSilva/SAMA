import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Compass size={26} />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-800">
        Página não encontrada
      </h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Ir para o Dashboard
      </Link>
    </div>
  );
}
