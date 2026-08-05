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
    <div className="relative min-h-screen overflow-hidden bg-[var(--brand-primary)] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 20%, color-mix(in oklch, var(--brand-accent) 40%, transparent), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, color-mix(in oklch, var(--brand-accent) 22%, transparent), transparent 50%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
        <div className="mb-10 lg:mb-0">
          <Link to="/login" className="inline-block">
            <img
              src="/brand/sitemate-logo-light.png"
              alt="Sitemate"
              className="h-20 w-auto max-w-[220px] object-contain object-left sm:h-24"
            />
          </Link>
          <h1 className="mt-8 max-w-md font-[family-name:var(--font-sans)] text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
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
