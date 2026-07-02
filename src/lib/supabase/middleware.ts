import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { countEventosPendentes, landingPathComOnboarding, agendaPendentesQueryOpts } from "@/lib/calendario";
import { getOnboardingFlags } from "@/lib/onboarding/state";
import type { CargoPessoa } from "@/lib/constants";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ["/login", "/trocar-senha", "/auth/signout"];

/**
 * Atualiza a sessão Supabase a cada requisição e protege rotas autenticadas.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isPublicAsset =
    pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (!user && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("id, cargo, departamento, is_admin, senha_provisoria")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    if (perfil?.senha_provisoria) {
      url.pathname = "/trocar-senha";
      return NextResponse.redirect(url);
    }

    const pendentes = perfil
      ? await countEventosPendentes(supabase, agendaPendentesQueryOpts(perfil))
      : 0;

    const onboarding = await getOnboardingFlags(supabase, user.id);

    url.pathname = landingPathComOnboarding({
      cargo: perfil?.cargo as CargoPessoa | undefined,
      pendentes,
      onboardingCalendarioConcluido: onboarding.calendarioConcluido,
    });
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath && !isPublicAsset) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("ativo, senha_provisoria")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!perfil?.ativo) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("erro", "inativo");
      return NextResponse.redirect(url);
    }

    if (perfil.senha_provisoria && !pathname.startsWith("/trocar-senha")) {
      const url = request.nextUrl.clone();
      url.pathname = "/trocar-senha";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
