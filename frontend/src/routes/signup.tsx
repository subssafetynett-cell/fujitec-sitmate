import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/sheq/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, signup } from "@/lib/api";
import { isAuthenticated, setAuthSession } from "@/lib/auth";
import { isValidPassword, PASSWORD_RULES_MESSAGE } from "@/lib/password";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
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
        content: "Create a Sitemate account for your company.",
      },
    ],
  }),
  component: SignupPage,
});

type SignupErrors = {
  name?: string | undefined;
  email?: string | undefined;
  company?: string | undefined;
  password?: string | undefined;
  confirm?: string | undefined;
};

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-600">{message}</p>;
}

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [saving, setSaving] = useState(false);

  function clearError(field: keyof SignupErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validate() {
    const next: SignupErrors = {};
    if (!name.trim()) next.name = "Full name is required";

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address";
    }

    if (!company.trim()) next.company = "Company is required";

    if (!password) {
      next.password = "Password is required";
    } else if (!isValidPassword(password)) {
      next.password = PASSWORD_RULES_MESSAGE;
    }

    if (!confirm) {
      next.confirm = "Confirm password is required";
    } else if (password && confirm !== password) {
      next.confirm = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const result = await signup({
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        password,
        ...(mobile ? { mobile } : {}),
      });
      setAuthSession(result);
      toast.success("Account created");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthLayout
      title="Create your SHEQ account"
      subtitle="Join your company workspace to raise concerns, complete forms and track compliance."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Sign up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          New accounts join as Supervisor until an admin changes your role.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input
            id="signup-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            placeholder="e.g. Alex Morgan"
            className={cn("h-10 rounded-xl", errors.name && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.name)}
            autoFocus
          />
          <FieldError message={errors.name} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            placeholder="alex.morgan@company.com"
            className={cn("h-10 rounded-xl", errors.email && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.email)}
          />
          <FieldError message={errors.email} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-mobile">Mobile (optional)</Label>
          <Input
            id="signup-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+44 7700 900000"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-company">Company</Label>
          <Input
            id="signup-company"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              clearError("company");
            }}
            placeholder="e.g. Northgate Industrial Group"
            className={cn("h-10 rounded-xl", errors.company && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.company)}
            autoComplete="organization"
          />
          <FieldError message={errors.company} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError("password");
            }}
            placeholder="e.g. Password1!"
            className={cn("h-10 rounded-xl", errors.password && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.password)}
          />
          <p className="text-xs text-muted-foreground">
            At least 8 characters, with 1 uppercase letter, 1 number, and 1 special character.
          </p>
          <FieldError message={errors.password} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearError("confirm");
            }}
            placeholder="Re-enter password"
            className={cn("h-10 rounded-xl", errors.confirm && "border-red-500 focus-visible:ring-red-500")}
            aria-invalid={Boolean(errors.confirm)}
          />
          <FieldError message={errors.confirm} />
        </div>
        <Button type="submit" className="mt-2 h-10 rounded-xl" disabled={saving}>
          <UserPlus />
          {saving ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
