import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1F33] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 20%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(251,146,60,0.18), transparent 50%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        <div className="mb-10 lg:mb-0">
          <Link to="/login" className="inline-flex items-center gap-3">
            <img
              src="/brand/sitemate-logo.png"
              alt="Sitemate"
              className="h-12 w-auto object-contain"
            />
            <span>
              <span className="block text-lg font-bold tracking-tight">Sitemate</span>
              <span className="block text-sm text-sky-100/70">
                Safety · Health · Environment · Quality
              </span>
            </span>
          </Link>
          <h1 className="mt-8 max-w-md font-[family-name:var(--font-sans)] text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-sky-100/80">
            {subtitle}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-6 text-foreground shadow-2xl sm:p-8">
          {children}
          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
