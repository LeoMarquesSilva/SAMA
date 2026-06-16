"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { clsx } from "clsx";
import {
  formatDatetimeLocalBr,
  parseDatetimeLocalBr,
} from "@/lib/datetime-br";
import { toDatetimeLocal } from "@/lib/format";

type DatetimeBrInputProps = {
  label?: string;
  error?: string;
  name: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

function toLocalValue(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !value.endsWith("Z")) {
    return value.slice(0, 16);
  }
  return toDatetimeLocal(value);
}

export const DatetimeBrInput = forwardRef<HTMLInputElement, DatetimeBrInputProps>(
  function DatetimeBrInput(
    { label, error, name, id, defaultValue, required, onChange },
    ref
  ) {
    const hiddenRef = useRef<HTMLInputElement>(null);
    const displayRef = useRef("");
    useImperativeHandle(ref, () => hiddenRef.current!);

    const initialLocal = toLocalValue(defaultValue);
    const [display, setDisplay] = useState(() =>
      initialLocal ? formatDatetimeLocalBr(initialLocal) : ""
    );
    const [parseError, setParseError] = useState<string>();

    displayRef.current = display;

    function syncHidden(local: string) {
      const hidden = hiddenRef.current;
      if (!hidden) return;
      hidden.value = local;
      if (onChange) {
        onChange({
          currentTarget: hidden,
        } as ChangeEvent<HTMLInputElement>);
      }
    }

    function commit(text: string, allowEmpty: boolean): boolean {
      const trimmed = text.trim();
      if (!trimmed) {
        if (allowEmpty) {
          setParseError(undefined);
          syncHidden("");
          return true;
        }
        setParseError("Use DD/MM/AAAA HH:mm");
        return false;
      }

      const parsed = parseDatetimeLocalBr(trimmed);
      if (!parsed) {
        setParseError("Use DD/MM/AAAA HH:mm");
        return false;
      }

      setParseError(undefined);
      setDisplay(formatDatetimeLocalBr(parsed));
      syncHidden(parsed);
      return true;
    }

    function handleBlur(e: FocusEvent<HTMLInputElement>) {
      commit(e.currentTarget.value, !required);
    }

    useEffect(() => {
      const hidden = hiddenRef.current;
      if (!hidden?.form) return;

      function onSubmit() {
        commit(displayRef.current, !required);
      }

      const form = hidden.form;
      form.addEventListener("submit", onSubmit, { capture: true });
      return () => form.removeEventListener("submit", onSubmit, { capture: true });
    }, [required]);

    useEffect(() => {
      const local = toLocalValue(defaultValue);
      if (local) {
        setDisplay(formatDatetimeLocalBr(local));
        syncHidden(local);
      } else if (!defaultValue) {
        setDisplay("");
        syncHidden("");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultValue]);

    const errMsg = error || parseError;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          ref={hiddenRef}
          type="hidden"
          name={name}
          defaultValue={initialLocal}
        />
        <input
          id={id}
          type="text"
          inputMode="numeric"
          lang="pt-BR"
          placeholder="DD/MM/AAAA HH:mm"
          autoComplete="off"
          required={required}
          value={display}
          onChange={(e) => {
            setDisplay(e.target.value);
            setParseError(undefined);
          }}
          onBlur={handleBlur}
          className={clsx(
            "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
            errMsg && "border-red-400 focus:border-red-500 focus:ring-red-500"
          )}
        />
        {errMsg && <span className="text-xs text-red-600">{errMsg}</span>}
      </div>
    );
  }
);
