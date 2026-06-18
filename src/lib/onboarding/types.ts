export type OnboardingTourId = "calendario" | "dashboard" | "proximos_passos";

export type OnboardingDemoKind =
  | "evento"
  | "evento-acoes"
  | "reuniao-abertura"
  | "reuniao-tipo"
  | "reuniao-cliente"
  | "reuniao-participantes"
  | "reuniao-resultado"
  | "reuniao-salvar"
  | "passos-grupo"
  | "passos-checklist"
  | "passos-ver-reuniao";

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  /** data-onboarding do elemento a destacar */
  target?: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  demo?: OnboardingDemoKind;
  /** Texto do botão principal no último passo */
  finishLabel?: string;
  /** Link sugerido ao concluir (ex.: ir ao dashboard) */
  nextHref?: string;
  nextHrefLabel?: string;
};

export type OnboardingState = {
  calendarioConcluido: boolean;
  dashboardConcluido: boolean;
  proximosPassosConcluido: boolean;
};
