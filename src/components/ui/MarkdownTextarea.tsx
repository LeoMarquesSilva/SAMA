"use client";

import { clsx } from "clsx";
import { useEffect, useId, useRef, type HTMLAttributes } from "react";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown-editor";

type MarkdownTextareaProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "value" | "onChange"
> & {
  label?: string;
  labelAdornment?: React.ReactNode;
  error?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
};

export function MarkdownTextarea({
  label,
  labelAdornment,
  error,
  className,
  id,
  name,
  value,
  onChange,
  rows = 3,
  required,
  ...props
}: MarkdownTextareaProps) {
  const autoId = useId();
  const fieldId = id ?? (label ? autoId : undefined);
  const labelId = fieldId ? `${fieldId}-label` : undefined;
  const editorRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    // Não reescrever o DOM enquanto o usuário digita — isso reposiciona o cursor
    // no início e faz as letras aparecerem ao contrário.
    if (!el || syncing.current || document.activeElement === el) return;
    syncing.current = true;
    el.innerHTML = markdownToHtml(value) || "<br>";
    syncing.current = false;
  }, [value]);

  function syncFromEditor() {
    const el = editorRef.current;
    if (!el || syncing.current) return;

    syncing.current = true;
    onChange(htmlToMarkdown(el.innerHTML));
    syncing.current = false;
  }

  function applyMarkdownToEditor() {
    const el = editorRef.current;
    if (!el || syncing.current) return;
    const markdown = htmlToMarkdown(el.innerHTML);
    syncing.current = true;
    el.innerHTML = markdownToHtml(markdown) || "<br>";
    syncing.current = false;
  }

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label
            id={labelId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </label>
          {labelAdornment}
        </div>
      ) : labelAdornment ? (
        <div className="flex justify-end">{labelAdornment}</div>
      ) : null}
      {name ? (
        <input type="hidden" name={name} value={value} required={required} />
      ) : null}
      <div
        {...props}
        id={fieldId}
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={label ? labelId : undefined}
        data-placeholder="Use **negrito** e *itálico*"
        onInput={syncFromEditor}
        onBlur={applyMarkdownToEditor}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className={clsx(
          "min-w-0 whitespace-pre-wrap break-words rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
          "empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500",
          className
        )}
        style={{ minHeight: `${Math.max(rows, 3) * 1.55}rem` }}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
