import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "SAMA — Metas & Atividades dos Sócios",
  description:
    "Controle gerencial de reuniões externas, atividades internas e timesheet dos sócios.",
  manifest: "/manifest.webmanifest",
  applicationName: "SAMA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SAMA",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2447d0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
