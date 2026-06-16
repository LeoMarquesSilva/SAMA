"use client";

import { Suspense } from "react";
import { LoginBrandPanel } from "@/components/auth/LoginBrandPanel";
import { LoginFormPanel } from "@/components/auth/LoginFormPanel";

function LoginContent() {
  return (
    <main className="flex min-h-[100dvh] flex-col lg:flex-row">
      <LoginBrandPanel />
      <LoginFormPanel />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
