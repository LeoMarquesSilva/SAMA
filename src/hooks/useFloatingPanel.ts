"use client";

import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { Z } from "@/lib/zIndex";

/** Posiciona painel flutuante (portal) ancorado a um botão/input. */
export function useFloatingPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  dropUp: boolean
) {
  const [style, setStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;

    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;

      if (dropUp) {
        setStyle({
          position: "fixed",
          left: rect.left,
          width: Math.max(rect.width, 220),
          bottom: window.innerHeight - rect.top + gap,
          maxHeight: Math.max(rect.top - gap - 8, 120),
          zIndex: Z.popover,
        });
      } else {
        setStyle({
          position: "fixed",
          left: rect.left,
          width: Math.max(rect.width, 220),
          top: rect.bottom + gap,
          maxHeight: Math.max(window.innerHeight - rect.bottom - gap - 8, 120),
          zIndex: Z.popover,
        });
      }
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, dropUp, anchorRef]);

  return style;
}
