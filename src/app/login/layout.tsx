import { DM_Sans, Outfit } from "next/font/google";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-login-sans",
  display: "swap",
});

const display = Outfit({
  subsets: ["latin"],
  variable: "--font-login-display",
  display: "swap",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${sans.variable} ${display.variable} min-h-[100dvh] font-[family-name:var(--font-login-sans)] antialiased`}
    >
      {children}
    </div>
  );
}
