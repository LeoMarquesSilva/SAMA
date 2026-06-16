"use client";

import { Monitor } from "lucide-react";
import Link from "next/link";

export function DesktopOnly({
  title,
  description,
  backHref = "/dashboard",
  backLabel = "Voltar ao início",
  children,
}: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center md:hidden">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Monitor size={28} />
        </span>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {backLabel}
        </Link>
      </div>
      <div className="hidden md:block">{children}</div>
    </>
  );
}
