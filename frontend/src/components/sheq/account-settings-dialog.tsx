import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@/data/sheq";
import { ApiError, changePassword } from "@/lib/api";
import { isValidPassword, PASSWORD_RULES_MESSAGE } from "@/lib/password";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function AccountSettingsDialog({ user, open, onOpenChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setErrors({});
    setSaving(false);
  }, [open]);

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!currentPassword.trim()) {
      next.currentPassword = "Current password is required";
    }
    if (!newPassword.trim()) {
      next.newPassword = "New password is required";
    } else if (!isValidPassword(newPassword)) {
      next.newPassword = PASSWORD_RULES_MESSAGE;
    } else if (newPassword === currentPassword) {
      next.newPassword = "New password must be different from the current password";
    }
    if (!confirmPassword.trim()) {
      next.confirmPassword = "Confirm your new password";
    } else if (confirmPassword !== newPassword) {
      next.confirmPassword = "Passwords do not match";
    }
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      toast.success("Password updated");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to update password";
      if (/current password/i.test(message)) {
        setErrors({ currentPassword: message });
      } else if (/password/i.test(message)) {
        setErrors({ newPassword: message });
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-muted-foreground" />
            Account settings
          </DialogTitle>
          <DialogDescription>
            View your account details and update your password.
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Profile
              </p>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="text-right font-medium">{user.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate text-right font-medium">{user.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="text-right font-medium">{user.role}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Company</dt>
                  <dd className="text-right font-medium">{user.company || "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Change password</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="account-current-password">Current password</Label>
                <Input
                  id="account-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    clearError("currentPassword");
                  }}
                  className={cn(
                    "rounded-xl",
                    errors.currentPassword &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                  aria-invalid={Boolean(errors.currentPassword)}
                />
                {errors.currentPassword ? (
                  <p className="text-sm font-medium text-red-600">
                    {errors.currentPassword}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    clearError("newPassword");
                  }}
                  className={cn(
                    "rounded-xl",
                    errors.newPassword && "border-red-500 focus-visible:ring-red-500",
                  )}
                  aria-invalid={Boolean(errors.newPassword)}
                />
                <p
                  className={cn(
                    "text-xs",
                    errors.newPassword ? "text-red-600" : "text-muted-foreground",
                  )}
                >
                  {errors.newPassword || PASSWORD_RULES_MESSAGE}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="account-confirm-password">Confirm new password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError("confirmPassword");
                  }}
                  className={cn(
                    "rounded-xl",
                    errors.confirmPassword &&
                      "border-red-500 focus-visible:ring-red-500",
                  )}
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
                {errors.confirmPassword ? (
                  <p className="text-sm font-medium text-red-600">
                    {errors.confirmPassword}
                  </p>
                ) : null}
              </div>
            </section>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {saving ? "Updating…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
