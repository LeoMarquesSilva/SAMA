/** Alvos do tour nos links de navegação — mapa estável para SSR e cliente. */
const NAV_ONBOARDING_BY_HREF: Record<string, string> = {
  "/dashboard": "nav-dashboard",
  "/calendario": "nav-calendario",
  "/proximos-passos": "nav-proximos-passos",
};

/** Props seguras para hidratação: omite o atributo quando não há tour neste link. */
export function navOnboardingProps(
  href: string
): { "data-onboarding": string } | Record<string, never> {
  const target = NAV_ONBOARDING_BY_HREF[href];
  if (!target) return {};
  return { "data-onboarding": target };
}

/** Props seguras para botões/elementos com alvo opcional de onboarding. */
export function onboardingProps(
  target: string | undefined | null
): { "data-onboarding": string } | Record<string, never> {
  if (!target) return {};
  return { "data-onboarding": target };
}
