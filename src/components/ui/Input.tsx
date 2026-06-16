import { clsx } from "clsx";
import { forwardRef, useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label?: string;
  error?: string;
};

const LOCALE_DATE_TYPES = new Set(["date", "datetime-local", "time"]);

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, className, id, lang, type, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? (label ? autoId : undefined);
  const localeDate = type && LOCALE_DATE_TYPES.has(type);
  return (
    <div className="flex flex-col gap-1">
      {label && inputId && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {label && !inputId && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        id={inputId}
        ref={ref}
        type={type}
        lang={lang ?? (localeDate ? "pt-BR" : undefined)}
        className={clsx(
          "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ label, error, className, id, rows = 3, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? (label ? autoId : undefined);
  return (
    <div className="flex flex-col gap-1">
      {label && inputId && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {label && !inputId && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        className={clsx(
          "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          error && "border-red-400",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ label, error, className, id, children, ...props }, ref) {
  const autoId = useId();
  const selectId = id ?? (label ? autoId : undefined);
  return (
    <div className="flex flex-col gap-1">
      {label && selectId && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      {label && !selectId && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <select
        id={selectId}
        ref={ref}
        className={clsx(
          "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          error && "border-red-400",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
});
