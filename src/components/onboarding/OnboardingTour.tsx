"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OnboardingDemoCategorizacao } from "@/components/onboarding/OnboardingDemoCategorizacao";
import { concluirOnboardingTour } from "@/app/(app)/onboarding/actions";
import type { OnboardingStep, OnboardingTourId } from "@/lib/onboarding/types";

type Rect = { top: number; left: number; width: number; height: number };

function queryTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  return document.querySelector<HTMLElement>(`[data-onboarding="${target}"]`);
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

export function OnboardingTour({
  tourId,
  steps,
  active,
  onClose,
}: {
  tourId: OnboardingTourId;
  steps: OnboardingStep[];
  active: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const [finishing, setFinishing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const isCenter = !step?.target || step.placement === "center";
  const hasDemo = Boolean(step?.demo);

  const updateLayout = useCallback(() => {
    if (!active || !step) return;

    if (isCenter || hasDemo) {
      setTargetRect(null);
      setCardStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "min(28rem, calc(100vw - 2rem))",
      });
      return;
    }

    const el = queryTarget(step.target);
    if (!el) {
      setTargetRect(null);
      setCardStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "min(28rem, calc(100vw - 2rem))",
      });
      return;
    }

    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const rect = measure(el);
    const pad = 8;
    setTargetRect({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    const cardW = Math.min(448, window.innerWidth - 32);
    const gap = 12;
    const placement = step.placement ?? "bottom";
    let top = rect.top + rect.height + gap;
    let left = rect.left;

    if (placement === "top") {
      top = rect.top - gap - 220;
    } else if (placement === "left") {
      top = rect.top;
      left = rect.left - cardW - gap;
    } else if (placement === "right") {
      top = rect.top;
      left = rect.left + rect.width + gap;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 240));

    setCardStyle({
      top,
      left,
      maxWidth: cardW,
      transform: "none",
    });
  }, [active, step, isCenter, hasDemo]);

  useLayoutEffect(() => {
    updateLayout();
  }, [updateLayout, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => updateLayout();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, updateLayout]);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setFinishing(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  async function finish(skipped = false) {
    setFinishing(true);
    await concluirOnboardingTour(tourId);
    setFinishing(false);
    onClose();
  }

  function next() {
    if (isLast) {
      void finish(false);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function prev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (!active || !step) return null;

  return (
    <div className="fixed inset-0 z-[200] print:hidden" role="dialog" aria-modal>
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[1px]"
        aria-hidden
      />

      {targetRect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand-400 transition-all duration-300"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
          }}
        />
      )}

      <div
        ref={cardRef}
        className={clsx(
          "absolute z-10 flex max-h-[min(85vh,640px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
          hasDemo ? "w-[min(28rem,calc(100vw-2rem))]" : "w-full"
        )}
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                Tour guiado · passo {stepIndex + 1} de {steps.length}
              </p>
              <h2 className="text-base font-bold text-slate-800">{step.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void finish(true)}
            disabled={finishing}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Pular tour"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>

          {step.demo && (
            <div className="mt-4">
              <OnboardingDemoCategorizacao kind={step.demo} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            onClick={() => void finish(true)}
            disabled={finishing}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Pular tour
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={prev}
                disabled={finishing}
              >
                <ChevronLeft size={16} /> Voltar
              </Button>
            )}

            {isLast && step.nextHref ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  void finish(false);
                  router.push(step.nextHref!);
                }}
                disabled={finishing}
              >
                {step.nextHrefLabel ?? step.finishLabel ?? "Continuar"}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={next} disabled={finishing}>
                {isLast ? (
                  step.finishLabel ?? "Concluir"
                ) : (
                  <>
                    Avançar <ChevronRight size={16} />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
