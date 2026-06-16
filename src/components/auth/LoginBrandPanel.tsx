import {
  BarChart3,
  CalendarDays,
  ShieldCheck,
  Target,
} from "lucide-react";
import { APP_FULL_NAME, APP_NAME } from "@/lib/constants";

const features = [
  {
    icon: Target,
    title: "Metas e indicadores",
    description: "Acompanhe resultados e metas da equipe em tempo real.",
  },
  {
    icon: CalendarDays,
    title: "Reuniões e calendário",
    description: "Organize agendas, tipos de reunião e compromissos.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e análises",
    description: "Visualize produtividade e desempenho com clareza.",
  },
];

export function LoginBrandPanel() {
  return (
    <section className="login-brand-panel relative overflow-hidden bg-brand-600 px-6 py-8 sm:px-10 sm:py-10 lg:flex lg:min-h-[100dvh] lg:w-[52%] lg:flex-col lg:justify-between lg:px-14 lg:py-14 xl:w-[55%] xl:px-16">
      <div className="login-grid pointer-events-none absolute inset-0 opacity-[0.35]" />
      <div className="login-glow pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="login-glow pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 login-fade-up" style={{ animationDelay: "0.05s" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 backdrop-blur-sm">
            <Target size={22} strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-[family-name:var(--font-login-display)] text-xl font-bold tracking-tight text-white sm:text-2xl">
              {APP_NAME}
            </p>
            <p className="text-xs text-brand-200 sm:text-sm">{APP_FULL_NAME}</p>
          </div>
        </div>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-200 lg:hidden">
          Metas, reuniões e relatórios em um só lugar.
        </p>
      </div>

      <div className="relative z-10 mt-8 hidden max-w-lg lg:mt-0 lg:block">
        <h2
          className="login-fade-up font-[family-name:var(--font-login-display)] text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl"
          style={{ animationDelay: "0.12s" }}
        >
          Gestão estratégica de metas, reuniões e produtividade.
        </h2>
        <p
          className="login-fade-up mt-4 text-base leading-relaxed text-brand-200"
          style={{ animationDelay: "0.18s" }}
        >
          Centralize indicadores e relatórios da equipe em um único
          ambiente seguro e integrado.
        </p>

        <ul className="mt-10 space-y-4">
          {features.map(({ icon: Icon, title, description }, index) => (
            <li
              key={title}
              className="login-fade-up flex gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.09]"
              style={{ animationDelay: `${0.24 + index * 0.07}s` }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Icon size={18} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-sm leading-snug text-brand-200/90">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="relative z-10 login-fade-up mt-6 flex items-center gap-2 text-xs text-brand-300 lg:mt-0"
        style={{ animationDelay: "0.52s" }}
      >
        <ShieldCheck size={14} className="shrink-0 text-brand-200" />
        <span>Acesso restrito · Bismarchi Pires</span>
      </div>
    </section>
  );
}
