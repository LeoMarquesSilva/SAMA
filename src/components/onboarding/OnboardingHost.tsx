"use client";

import { useEffect, useState } from "react";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CALENDARIO_TOUR_STEPS } from "@/lib/onboarding/tours/calendario";
import { DASHBOARD_TOUR_STEPS } from "@/lib/onboarding/tours/dashboard";
import { PROXIMOS_PASSOS_TOUR_STEPS } from "@/lib/onboarding/tours/proximos-passos";
import type { OnboardingTourId } from "@/lib/onboarding/types";

const TOUR_STEPS = {
  calendario: CALENDARIO_TOUR_STEPS,
  dashboard: DASHBOARD_TOUR_STEPS,
  proximos_passos: PROXIMOS_PASSOS_TOUR_STEPS,
} as const;

export function OnboardingHost({
  tourId,
  enabled,
}: {
  tourId: OnboardingTourId;
  enabled: boolean;
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
      steps={[...TOUR_STEPS[tourId]]}
      active={active}
      onClose={() => {
        setActive(false);
        setDismissed(true);
      }}
    />
  );
}
