import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";

import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { AlertasPendentesOverlay } from "@/components/layout/AlertasPendentesOverlay";
import { CALENDARIO_PATH, countEventosPendentes, agendaPendentesQueryOpts } from "@/lib/calendario";
import { countPassosPendentes, PROXIMOS_PASSOS_PATH } from "@/lib/proximos-passos";
import { shouldShowAlertasLoginBanner } from "@/lib/alertas-login";
import type { CargoPessoa } from "@/lib/constants";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Salvaguarda além do middleware.
  if (!user) redirect("/login");

  // Carrega o perfil de domínio vinculado ao login.
  const { data: pessoa } = await supabase
    .from("usuarios")
    .select("nome, email, avatar_url, senha_provisoria")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Força troca da senha provisória antes de usar o sistema.
  if (pessoa?.senha_provisoria) redirect("/trocar-senha");

  const { data: pessoaRow } = await supabase
    .from("usuarios")
    .select("id, is_admin, cargo, departamento")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const isAdmin = pessoaRow?.is_admin ?? false;
  const navContext = {
    cargo: (pessoaRow?.cargo ?? "COLABORADOR") as CargoPessoa,
    isAdmin,
  };

  const pendentes = await countEventosPendentes(
    supabase,
    agendaPendentesQueryOpts(
      pessoaRow
        ? {
            id: pessoaRow.id,
            is_admin: pessoaRow.is_admin,
            cargo: (pessoaRow.cargo ?? "COLABORADOR") as CargoPessoa,
            departamento: pessoaRow.departamento,
          }
        : null
    )
  );
  const passosPendentes = await countPassosPendentes(supabase, {
    pessoaId: pessoaRow?.id,
    isAdmin,
  });
  const showAlertasLogin = await shouldShowAlertasLoginBanner();

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
            "vios_tarefas",
          ]}
        />
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
              email={user.email ?? "—"}
              avatarUrl={pessoa?.avatar_url ?? null}
            />
            <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-6 md:pb-6">
              {children}
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
