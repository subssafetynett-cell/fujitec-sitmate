import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/sheq/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login } from "@/lib/api";
import { isAuthenticated, setAuthSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && isAuthenticated()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content: "Sign in to the Sitemate platform.",
      },
    ],
  }),
  component: LoginPage,
});

type LoginErrors = {
  email?: string | undefined;
  password?: string | undefined;
};

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-600">{message}</p>;
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const next: LoginErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address";
    }
    if (!password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const result = await login({ email: email.trim(), password });
      setAuthSession(result);
      toast.success(`Welcome back, ${result.user.name.split(" ")[0]}`);
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in to your workspace"
      subtitle="Manage audits, concerns, site packs and SHEQ forms from one secure platform."
      footer={
        <>
          Don’t have an account?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your work email and password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@company.com"
            className={cn("h-10 rounded-xl", errors.email && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.email)}
            autoFocus
          />
          <FieldError message={errors.email} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            placeholder="••••••••"
            className={cn("h-10 rounded-xl", errors.password && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.password)}
          />
          <FieldError message={errors.password} />
        </div>
        <Button type="submit" className="mt-2 h-10 rounded-xl" disabled={saving}>
          <LogIn />
          {saving ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Demo seed users use password <span className="font-medium text-foreground">password123</span>
      </p>
    </AuthLayout>
  );
}
