import { LogOut, Target } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export function Header({
  nome,
  email,
  avatarUrl,
}: {
  nome: string | null;
  email: string;
  avatarUrl: string | null;
}) {
  const label = nome ?? email;

  return (
    <header className="flex items-center border-b border-slate-200 bg-white px-4 py-3 md:px-6 print:hidden">
      {/* Logo aparece no mobile (sidebar fica oculta) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Target size={16} />
        </div>
        <span className="text-sm font-bold text-slate-800">SAMA</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar nome={label} src={avatarUrl} size={32} />
          <span className="hidden text-sm text-slate-600 sm:inline">
            {label}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Sair"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
