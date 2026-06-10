import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-brand-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "text-slate-600 hover:bg-slate-100 focus:ring-brand-500",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
