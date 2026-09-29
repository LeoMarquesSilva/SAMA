"use client";

import { useEffect, useState } from "react";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CALENDARIO_TOUR_STEPS } from "@/lib/onboarding/tours/calendario";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tours/dashboard";
import { PROXIMOS_PASSOS_TOUR_STEPS } from "@/lib/onboarding/tours/proximos-passos";
import { AGENDAMENTO_TOUR_STEPS } from "@/lib/onboarding/tours/agendamento";
import type { OnboardingStep, OnboardingTourId } from "@/lib/onboarding/types";

const TOUR_STEPS = {
  calendario: CALENDARIO_TOUR_STEPS,
  dashboard: DASHBOARD_TOUR_STEPS,
  proximos_passos: PROXIMOS_PASSOS_TOUR_STEPS,
  agendamento: AGENDAMENTO_TOUR_STEPS,
} as const;

export function OnboardingHost({
  tourId,
  enabled,
  onStepChange,
  onFinished,
}: {
  tourId: OnboardingTourId;
  enabled: boolean;
  onStepChange?: (step: OnboardingStep) => void;
  onFinished?: () => void;
}) {
  const [active, setActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled || dismissed) return;
    const t = window.setTimeout(() => setActive(true), 600);
    return () => window.clearTimeout(t);
  }, [enabled, dismissed]);

  if (!enabled) return null;

  return (
    <OnboardingTour
      tourId={tourId}
      steps={TOUR_STEPS[tourId]}
      active={active}
      onStepChange={onStepChange}
      onClose={() => {
        setActive(false);
        setDismissed(true);
        onFinished?.();
      }}
    />
  );
}
