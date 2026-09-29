import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";

import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { Suspense } from "react";
import { NavegacaoProgresso, ConteudoNavegacao } from "@/components/layout/Navegacao";
import { AlertasPendentesOverlay } from "@/components/layout/AlertasPendentesOverlay";
import { CALENDARIO_PATH, countEventosPendentes, agendaPendentesQueryOpts } from "@/lib/calendario";
import { countPassosPendentes, PROXIMOS_PASSOS_PATH } from "@/lib/proximos-passos";
import { shouldShowAlertasLoginBanner } from "@/lib/alertas-login";
import type { CargoPessoa } from "@/lib/constants";
import { getModulosAtuais, getPessoaAtual } from "@/lib/currentPessoa";
import { urlDeFotoUtil } from "@/lib/avatar-url";
import { variantesEmailEscritorio } from "@/lib/email-escritorio";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const pessoa = await getPessoaAtual();
  if (!pessoa) redirect("/login");
  if (pessoa.senha_provisoria) redirect("/trocar-senha");

  const isAdmin = pessoa.is_admin;

  const [modulos, pendentes, passosPendentes, showAlertasLogin, { data: fotos }] = await Promise.all([
    getModulosAtuais(),
    countEventosPendentes(supabase, agendaPendentesQueryOpts(pessoa)),
    countPassosPendentes(supabase, { pessoaId: pessoa.id }),
    shouldShowAlertasLoginBanner(),
    supabase
      .from("colaboradores")
      .select("avatar_url")
      .in("email", variantesEmailEscritorio(pessoa.email))
      .eq("ativo", true)
      .limit(1),
  ]);

  const navContext = {
    cargo: (pessoa.cargo ?? "COLABORADOR") as CargoPessoa,
    isAdmin,
    modulos,
  };

  const badges: Record<string, number> = {};
  if (pendentes) badges[CALENDARIO_PATH] = pendentes;
  if (passosPendentes) badges[PROXIMOS_PASSOS_PATH] = passosPendentes;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <RealtimeRefresh
          tables={[
            "outlook_eventos",
            "reunioes",
            "reuniao_participantes",
            "atividades_internas",
            "timesheet_entradas",
            "usuarios",
          ]}
        />
        <Suspense fallback={null}>
          <NavegacaoProgresso />
        </Suspense>
        <div className="flex h-screen overflow-hidden">
          <AlertasPendentesOverlay
            showInitially={showAlertasLogin}
            nome={pessoa?.nome ?? null}
            naoCategorizados={pendentes}
            passosPendentes={passosPendentes}
          />
          <Sidebar badges={badges} navContext={navContext} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header
              nome={pessoa?.nome ?? null}
              email={pessoa.email}
              avatarUrl={urlDeFotoUtil(fotos?.[0]?.avatar_url ?? pessoa.avatar_url)}
            />
            <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-6 md:pb-6">
              <ConteudoNavegacao>{children}</ConteudoNavegacao>
            </main>
          </div>
          <MobileNav
            isAdmin={isAdmin}
            navContext={navContext}
            badges={badges}
          />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
