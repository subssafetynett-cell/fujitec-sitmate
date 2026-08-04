import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Eye,
  Pencil,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, Panel, EmptyState } from "@/components/sheq/primitives";
import { StatCard } from "@/components/sheq/stat-card";
import { StatusPill } from "@/components/sheq/status-pill";
import { UserDetailsDialog } from "@/components/sheq/user-details-dialog";
import type { User, UserRole } from "@/data/sheq";
import { ApiError, deleteUser, inviteUser, updateUser } from "@/lib/api";
import {
  assignableRolesFor,
  canManageUsers,
  getAuthUser,
  isSuperAdmin,
  scopeUsersToActor,
} from "@/lib/auth";
import { isValidPassword, PASSWORD_RULES_MESSAGE } from "@/lib/password";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UserFormErrors = {
  name?: string | undefined;
  email?: string | undefined;
  mobile?: string | undefined;
  company?: string | undefined;
  password?: string | undefined;
};

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-600">{message}</p>;
}

export const Route = createFileRoute("/users")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!canManageUsers(getAuthUser())) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Manage platform users, roles and site access across the SHEQ organisation.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Invite, manage and review user access across every site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

const roles = [
  "All roles",
  "Super Admin",
  "Company Admin",
  "Supervisor",
  "Site Manager",
] as const;
const statuses = ["All statuses", "Active", "Invited", "Suspended"] as const;
const PAGE_SIZE = 10;

function UsersPage() {
  const { users: allUsers, companies } = useSheq();
  const queryClient = useQueryClient();
  const currentUser = getAuthUser();
  const isSuper = isSuperAdmin(currentUser);
  const users = useMemo(
    () => scopeUsersToActor(currentUser, allUsers),
    [currentUser, allUsers],
  );
  const companyOptions = useMemo(() => {
    if (isSuper) return companies;
    const own = currentUser?.company?.trim();
    if (!own) return [];
    const match = companies.filter(
      (c) => c.name.trim().toLowerCase() === own.toLowerCase(),
    );
    return match.length > 0 ? match : [{ id: "own", name: own, industry: "", country: "", logo: "", status: "Active" as const, createdAt: "" }];
  }, [isSuper, companies, currentUser?.company]);
  const companyFilterOptions = useMemo(() => {
    const names = [...new Set(users.map((u) => u.company.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return ["All companies", ...names] as const;
  }, [users]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("All roles");
  const [status, setStatus] = useState<(typeof statuses)[number]>("All statuses");
  const [companyFilter, setCompanyFilter] = useState<string>("All companies");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"invite" | "edit">("invite");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("Supervisor");
  const [formStatus, setFormStatus] = useState<User["status"]>("Invited");
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailsUser, setDetailsUser] = useState<User | null>(null);

  const formRoles = useMemo(
    () =>
      assignableRolesFor(
        currentUser,
        formMode === "edit" ? formRole : undefined,
      ),
    [currentUser, formMode, formRole],
  );

  function clearFormError(field: keyof UserFormErrors) {
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function resetForm() {
    setEditingUserId(null);
    setFormName("");
    setFormEmail("");
    setFormMobile("");
    setFormCompany(
      isSuper
        ? (companyOptions[0]?.name ?? "")
        : (currentUser?.company ?? companyOptions[0]?.name ?? ""),
    );
    setFormPassword("");
    setFormRole("Supervisor");
    setFormStatus("Invited");
    setFormErrors({});
  }

  function openInviteForm() {
    setFormMode("invite");
    resetForm();
    setFormOpen(true);
  }

  function openEditForm(user: User) {
    setFormMode("edit");
    setEditingUserId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormMobile(user.mobile ?? "");
    setFormCompany(user.company || companies[0]?.name || "");
    setFormPassword("");
    setFormRole(user.role);
    setFormStatus(user.status);
    setFormErrors({});
    setFormOpen(true);
  }

  function validateUserForm() {
    const next: UserFormErrors = {};
    const requiresPassword = formMode === "invite";

    if (!formName.trim()) next.name = "Full name is required";

    const trimmedEmail = formEmail.trim();
    if (!trimmedEmail) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      next.email = "Enter a valid email address";
    }

    if (!formMobile.trim()) next.mobile = "Mobile number is required";
    if (!formCompany) next.company = "Company is required";

    if (requiresPassword && !formPassword) {
      next.password = "Password is required";
    } else if (formPassword && !isValidPassword(formPassword)) {
      next.password = PASSWORD_RULES_MESSAGE;
    }

    setFormErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleUserForm(e: FormEvent) {
    e.preventDefault();
    if (!validateUserForm()) return;

    setSaving(true);
    try {
      if (formMode === "invite") {
        const user = await inviteUser({
          name: formName.trim(),
          email: formEmail.trim(),
          mobile: formMobile.trim(),
          company: formCompany,
          password: formPassword,
          role: formRole,
        });
        toast.success(`Invite sent to ${user.email}`);
      } else if (editingUserId) {
        const user = await updateUser(editingUserId, {
          name: formName.trim(),
          email: formEmail.trim(),
          mobile: formMobile.trim(),
          company: formCompany,
          ...(formPassword ? { password: formPassword } : {}),
          role: formRole,
          status: formStatus,
        });
        toast.success(`Updated ${user.name}`);
      }
      await queryClient.invalidateQueries({ queryKey: ["sheq"] });
      setFormOpen(false);
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : formMode === "invite"
            ? "Unable to invite user"
            : "Unable to update user",
      );
    } finally {
      setSaving(false);
    }
  }

  const rows = useMemo(() => {
    const filtered = users.filter(
      (u) =>
        (role === "All roles" || u.role === role) &&
        (status === "All statuses" || u.status === status) &&
        (companyFilter === "All companies" ||
          u.company.trim().toLowerCase() === companyFilter.trim().toLowerCase()) &&
        (q === "" ||
          `${u.id} ${u.name} ${u.email} ${u.role} ${u.company}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
    return [...filtered].sort((a, b) => {
      const companyCmp = a.company.localeCompare(b.company);
      if (companyCmp !== 0) return companyCmp;
      return a.name.localeCompare(b.name);
    });
  }, [users, q, role, status, companyFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, rows.length);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );
  const pageIds = useMemo(() => pagedRows.map((u) => u.id), [pagedRows]);

  useEffect(() => {
    setPage(1);
  }, [q, role, status, companyFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => rows.some((u) => u.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id)) && !allSelected;
  const selectedCount = selected.size;
  const selectedUsers = useMemo(
    () => users.filter((u) => selected.has(u.id)),
    [users, selected],
  );

  const active = users.filter((u) => u.status === "Active").length;
  const invited = users.filter((u) => u.status === "Invited").length;
  const suspended = users.filter((u) => u.status === "Suspended").length;
  const admins = users.filter(
    (u) => u.role === "Super Admin" || u.role === "Company Admin",
  ).length;

  function enterSelectMode() {
    setSelectMode(true);
    setSelected(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of pageIds) next.add(id);
      } else {
        for (const id of pageIds) next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function refreshUsers() {
    await queryClient.invalidateQueries({ queryKey: ["sheq"] });
  }

  async function handleDeleteConfirmed() {
    const ids =
      bulkDeleteIds ?? (deleteTarget ? [deleteTarget.id] : []);
    if (ids.length === 0) return;

    setDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteUser(id)));
      const deleted = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - deleted;
      await refreshUsers();

      if (deleted > 0 && failed === 0) {
        toast.success(
          deleted === 1
            ? `${deleteTarget?.name ?? "User"} deleted`
            : `Deleted ${deleted} users`,
        );
      } else if (deleted > 0) {
        toast.message(`Deleted ${deleted}, failed ${failed}`);
      } else {
        const firstError = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        const message =
          firstError?.reason instanceof ApiError
            ? firstError.reason.message
            : "Unable to delete user";
        toast.error(message);
      }

      setDeleteTarget(null);
      setBulkDeleteIds(null);
      exitSelectMode();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete user");
    } finally {
      setDeleting(false);
    }
  }

  function runBulk(action: "suspend" | "reactivate" | "resend" | "delete") {
    if (selectedCount === 0) {
      toast.message("Select at least one user");
      return;
    }

    const label = `${selectedCount} user${selectedCount === 1 ? "" : "s"}`;

    if (action === "suspend") {
      const n = selectedUsers.filter((u) => u.status === "Active").length;
      toast.message(n ? `Suspended ${n} of ${label}` : "No active users in selection");
      exitSelectMode();
    } else if (action === "reactivate") {
      const n = selectedUsers.filter((u) => u.status === "Suspended").length;
      toast.success(n ? `Reactivated ${n} of ${label}` : "No suspended users in selection");
      exitSelectMode();
    } else if (action === "resend") {
      const n = selectedUsers.filter((u) => u.status === "Invited").length;
      toast.success(n ? `Resent invites to ${n} of ${label}` : "No invited users in selection");
      exitSelectMode();
    } else {
      setBulkDeleteIds([...selected]);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description={
          isSuper
            ? "All users across every company, grouped by company name."
            : `Users in ${currentUser?.company || "your company"} only.`
        }
        actions={
          <Button className="rounded-xl" onClick={openInviteForm}>
            <UserPlus /> Invite user
          </Button>
        }
      />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "invite" ? "Invite user" : "Edit user"}</DialogTitle>
            <DialogDescription>
              {formMode === "invite"
                ? "Enter their details, company and role. They’ll appear as Invited until they accept."
                : "Update user details, company, role or status. Leave password blank to keep the current one."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUserForm} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="user-name">
                Full name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="user-name"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  clearFormError("name");
                }}
                placeholder="e.g. Alex Morgan"
                className={cn(
                  "h-10 rounded-xl",
                  formErrors.name && "border-red-500 focus-visible:ring-red-500",
                )}
                aria-invalid={Boolean(formErrors.name)}
                autoFocus
              />
              <FieldError message={formErrors.name} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-email">
                Email <span className="text-red-600">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  clearFormError("email");
                }}
                placeholder="alex.morgan@company.com"
                className={cn(
                  "h-10 rounded-xl",
                  formErrors.email && "border-red-500 focus-visible:ring-red-500",
                )}
                aria-invalid={Boolean(formErrors.email)}
              />
              <FieldError message={formErrors.email} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-mobile">
                Mobile number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="user-mobile"
                type="tel"
                value={formMobile}
                onChange={(e) => {
                  setFormMobile(e.target.value);
                  clearFormError("mobile");
                }}
                placeholder="+44 7700 900000"
                className={cn(
                  "h-10 rounded-xl",
                  formErrors.mobile && "border-red-500 focus-visible:ring-red-500",
                )}
                aria-invalid={Boolean(formErrors.mobile)}
              />
              <FieldError message={formErrors.mobile} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-company">
                Company <span className="text-red-600">*</span>
              </Label>
              {isSuper ? (
                <Select
                  value={formCompany}
                  onValueChange={(v) => {
                    setFormCompany(v);
                    clearFormError("company");
                  }}
                >
                  <SelectTrigger
                    id="user-company"
                    className={cn(
                      "h-10 rounded-xl",
                      formErrors.company && "border-red-500 focus:ring-red-500",
                    )}
                    aria-invalid={Boolean(formErrors.company)}
                  >
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyOptions.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="user-company"
                  value={formCompany}
                  readOnly
                  className="h-10 rounded-xl bg-muted"
                />
              )}
              <FieldError message={formErrors.company} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-password">
                Password{" "}
                {formMode === "edit" ? (
                  <span className="font-normal text-muted-foreground">(optional)</span>
                ) : (
                  <span className="text-red-600">*</span>
                )}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={formPassword}
                onChange={(e) => {
                  setFormPassword(e.target.value);
                  clearFormError("password");
                }}
                placeholder={
                  formMode === "edit"
                    ? "Leave blank to keep current password"
                    : "e.g. Password1!"
                }
                className={cn(
                  "h-10 rounded-xl",
                  formErrors.password && "border-red-500 focus-visible:ring-red-500",
                )}
                aria-invalid={Boolean(formErrors.password)}
              />
              <p
                className={cn(
                  "text-xs",
                  formErrors.password ? "text-red-600" : "text-muted-foreground",
                )}
              >
                At least 8 characters, with 1 uppercase letter, 1 number, and 1 special character.
              </p>
              <FieldError message={formErrors.password} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={formRole}
                onValueChange={(v) => setFormRole(v as UserRole)}
              >
                <SelectTrigger id="user-role" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {formRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formMode === "edit" && (
              <div className="grid gap-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v) => setFormStatus(v as User["status"])}
                >
                  <SelectTrigger id="user-status" className="h-10 rounded-xl">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Invited">Invited</SelectItem>
                    <SelectItem value="Suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {formMode === "invite" ? <Mail /> : <Pencil />}
                {saving
                  ? formMode === "invite"
                    ? "Sending…"
                    : "Saving…"
                  : formMode === "invite"
                    ? "Send invite"
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UserDetailsDialog
        user={detailsUser}
        open={Boolean(detailsUser)}
        onOpenChange={(next) => {
          if (!next) setDetailsUser(null);
        }}
      />

      <Dialog
        open={Boolean(deleteTarget) || Boolean(bulkDeleteIds)}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setDeleteTarget(null);
            setBulkDeleteIds(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {bulkDeleteIds ? "Delete users" : "Delete user"}
            </DialogTitle>
            <DialogDescription>
              {bulkDeleteIds ? (
                <>
                  Delete{" "}
                  <span className="font-medium text-foreground">
                    {bulkDeleteIds.length} user{bulkDeleteIds.length === 1 ? "" : "s"}
                  </span>
                  ? This removes them from the database and cannot be undone.
                </>
              ) : (
                <>
                  Delete{" "}
                  <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
                  This removes them from the database and cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setDeleteTarget(null);
                setBulkDeleteIds(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={handleDeleteConfirmed}
              disabled={deleting}
            >
              <Trash2 />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={users.length} icon={Users} />
        <StatCard label="Active" value={active} icon={UserCheck} tone="success" />
        <StatCard label="Invited" value={invited} icon={Mail} />
        <StatCard label="Suspended" value={suspended} icon={UserX} tone="warning" />
      </div>

      <Panel
        className="mt-6"
        title="User directory"
        description={
          selectMode
            ? `${selectedCount} selected · ${
                rows.length === 0
                  ? "0 shown"
                  : `Showing ${pageStart}–${pageEnd} of ${rows.length}`
              }`
            : rows.length === 0
              ? `${admins} admin${admins === 1 ? "" : "s"} · 0 shown`
              : `${admins} admin${admins === 1 ? "" : "s"} · Showing ${pageStart}–${pageEnd} of ${rows.length}`
        }
        actions={
          selectMode ? (
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="rounded-xl"
                    disabled={selectedCount === 0}
                  >
                    Actions
                    {selectedCount > 0 ? ` (${selectedCount})` : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => runBulk("suspend")}>
                    <UserX /> Suspend
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulk("reactivate")}>
                    <UserCheck /> Reactivate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runBulk("resend")}>
                    <Mail /> Resend invite
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => runBulk("delete")}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={exitSelectMode}
              >
                <X /> Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={enterSelectMode}
            >
              <Users /> Bulk actions
            </Button>
          )
        }
      >
        <div
          className={cn(
            "mb-4 grid gap-3",
            isSuper
              ? "sm:grid-cols-[minmax(0,1fr)_160px_160px_180px]"
              : "sm:grid-cols-[minmax(0,1fr)_160px_160px]",
          )}
        >
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                isSuper
                  ? "Search name, email, role, company…"
                  : "Search name, email, role…"
              }
              className="h-10 rounded-xl pl-9"
              aria-label="Search users"
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as (typeof roles)[number])}>
            <SelectTrigger className="h-10 rounded-xl" aria-label="Filter by role">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as (typeof statuses)[number])}
          >
            <SelectTrigger className="h-10 rounded-xl" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSuper ? (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Filter by company">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                {companyFilterOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={users.length === 0 ? "No users yet" : "No users found"}
            description={
              users.length === 0
                ? "Invite a user to get started. New users will appear in this list."
                : "Try a different search or clear the role and status filters."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {selectMode && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="Select all users on this page"
                        />
                      </TableHead>
                    )}
                    <TableHead className="font-semibold">User</TableHead>
                    {!isSuper && (
                      <TableHead className="font-semibold">Company</TableHead>
                    )}
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Last active</TableHead>
                    {!selectMode && (
                      <TableHead className="w-12 text-right font-semibold">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((user, index) => {
                    const isSelected = selected.has(user.id);
                    const prev = pagedRows[index - 1];
                    const showCompanyHeader =
                      isSuper &&
                      (!prev ||
                        prev.company.trim().toLowerCase() !==
                          user.company.trim().toLowerCase());
                    const colSpan =
                      (selectMode ? 1 : 0) + (isSuper ? 0 : 1) + 4 + (selectMode ? 0 : 1);
                    return (
                      <Fragment key={user.id}>
                        {showCompanyHeader ? (
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell
                              colSpan={colSpan}
                              className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {user.company.trim() || "Unassigned company"}
                            </TableCell>
                          </TableRow>
                        ) : null}
                        <TableRow
                          data-state={isSelected ? "selected" : undefined}
                          className={selectMode ? "cursor-pointer" : undefined}
                          onClick={
                            selectMode
                              ? () => toggleOne(user.id, !isSelected)
                              : undefined
                          }
                        >
                          {selectMode && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(v) => toggleOne(user.id, v === true)}
                                aria-label={`Select ${user.name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {user.name
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{user.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          {!isSuper && (
                            <TableCell className="text-sm text-muted-foreground">
                              {user.company || "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <Shield className="size-3.5 text-muted-foreground" />
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusPill value={user.status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.lastActive}
                          </TableCell>
                          {!selectMode && (
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 rounded-lg"
                                    aria-label={`Actions for ${user.name}`}
                                  >
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setDetailsUser(user)}>
                                    <Eye /> User details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditForm(user)}>
                                    <Pencil /> Edit
                                  </DropdownMenuItem>
                                  {user.status === "Invited" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        toast.success(`Invite resent to ${user.email}`)
                                      }
                                    >
                                      <Mail /> Resend invite
                                    </DropdownMenuItem>
                                  )}
                                  {user.status === "Suspended" ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        toast.success(`${user.name} reactivated`)
                                      }
                                    >
                                      <UserCheck /> Reactivate
                                    </DropdownMenuItem>
                                  ) : user.status === "Active" ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        toast.message(`${user.name} suspended`)
                                      }
                                    >
                                      <UserX /> Suspend
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      setBulkDeleteIds(null);
                                      setDeleteTarget(user);
                                    }}
                                  >
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      variant={pageNumber === currentPage ? "default" : "outline"}
                      className="size-9 rounded-xl p-0"
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={pageNumber === currentPage ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
