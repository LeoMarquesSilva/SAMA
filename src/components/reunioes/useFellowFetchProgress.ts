"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STEPS = [
  { at: 0, label: "Preparando busca no Fellow…" },
  { at: 18, label: "Consultando gravações…" },
  { at: 42, label: "Localizando a reunião correspondente…" },
  { at: 68, label: "Extraindo resumo e próximos passos…" },
  { at: 86, label: "Finalizando importação…" },
] as const;

const MAX_WHILE_LOADING = 92;

function labelForProgress(progress: number): string {
  let current: string = STEPS[0].label;
  for (const step of STEPS) {
    if (progress >= step.at) current = step.label;
  }
  return current;
}

export function useFellowFetchProgress(active: boolean) {
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState<string>(STEPS[0].label);
  const completingRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (!completingRef.current) {
        setProgress(0);
        setStepLabel(STEPS[0].label);
      }
      return;
    }

    completingRef.current = false;
    setProgress(8);
    setStepLabel(labelForProgress(8));

    const id = window.setInterval(() => {
      setProgress((prev) => {
        const delta = Math.max(1, (MAX_WHILE_LOADING - prev) * 0.12);
        const next = Math.min(MAX_WHILE_LOADING, prev + delta);
        setStepLabel(labelForProgress(next));
        return next;
      });
    }, 450);

    return () => window.clearInterval(id);
  }, [active]);

  const complete = useCallback(async () => {
    completingRef.current = true;
    setProgress(100);
    setStepLabel("Importação concluída");
    await new Promise((resolve) => window.setTimeout(resolve, 280));
    completingRef.current = false;
  }, []);

  return { progress, stepLabel, complete };
}
