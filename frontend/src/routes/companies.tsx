import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
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
import type { CompanyOption } from "@/data/sheq";
import {
  ApiError,
  createCompany,
  deleteCompany,
  setCompanyStatus,
  updateCompany,
} from "@/lib/api";
import { canManageCompanies, getAuthUser } from "@/lib/auth";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { useSheq } from "@/lib/sheq-context";
import { toast } from "sonner";

export const Route = createFileRoute("/companies")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!canManageCompanies(getAuthUser())) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content: "Create and manage companies with branding logos across the SHEQ platform.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Register companies and upload logos for multi-tenant SHEQ access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompaniesPage,
});

const PAGE_SIZE = 10;

function CompaniesPage() {
  const { companies } = useSheq();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All statuses" | CompanyOption["status"]>(
    "All statuses",
  );
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyOption | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [logo, setLogo] = useState("");
  const [logoName, setLogoName] = useState("");
  const [companyStatus, setCompanyStatusLocal] =
    useState<CompanyOption["status"]>("Active");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(
    () =>
      companies.filter(
        (c) =>
          (status === "All statuses" || c.status === status) &&
          (q === "" ||
            `${c.name} ${c.industry} ${c.country}`
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [companies, q, status],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, rows.length);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const active = companies.filter((c) => c.status === "Active").length;

  function resetForm() {
    setEditing(null);
    setName("");
    setIndustry("");
    setCountry("");
    setLogo("");
    setLogoName("");
    setCompanyStatusLocal("Active");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(company: CompanyOption) {
    setEditing(company);
    setName(company.name);
    setIndustry(company.industry);
    setCountry(company.country);
    setLogo(company.logo || "");
    setLogoName(company.logo ? "Current logo" : "");
    setCompanyStatusLocal(company.status);
    setOpen(true);
  }

  async function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/companies",
        resourceType: "image",
        acceptImageOnly: true,
      });
      setLogo(url);
      setLogoName(file.name);
      if (uploaded) toast.success("Logo uploaded to Cloudinary");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload logo");
    } finally {
      e.target.value = "";
    }
  }

  async function refresh() {
    await queryClient.refetchQueries({ queryKey: ["sheq"] });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !industry.trim() || !country.trim()) {
      toast.message("Fill in company name, industry and country");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        industry: industry.trim(),
        country: country.trim(),
        status: companyStatus,
        ...(logo ? { logo } : {}),
      };
      if (editing) {
        const updated = await updateCompany(editing.id, payload);
        toast.success(`${updated.name} updated`);
      } else {
        const created = await createCompany(payload);
        toast.success(`${created.name} created`);
      }
      await refresh();
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : editing
            ? "Unable to update company"
            : "Unable to create company",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(company: CompanyOption) {
    const next = company.status === "Active" ? "Inactive" : "Active";
    try {
      const updated = await setCompanyStatus(company.id, next);
      await refresh();
      toast.success(
        next === "Inactive"
          ? `${updated.name} marked inactive`
          : `${updated.name} reactivated`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update status");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCompany(deleteTarget.id);
      await refresh();
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete company");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Companies"
        description="Create companies, upload logos and manage multi-tenant access."
        actions={
          <Button className="rounded-xl" onClick={openCreate}>
            <Plus /> Create company
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-lg sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company" : "Create company"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update company details and branding."
                : "Add a company profile and optional logo. New companies appear in the invite user list."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid min-w-0 gap-4 overflow-x-hidden">
            <div className="grid gap-2">
              <Label>Company logo</Label>
              <div className="flex max-w-full items-start gap-4 overflow-hidden rounded-xl border border-dashed border-border p-4">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                  {logo ? (
                    <img
                      src={logo}
                      alt="Company logo preview"
                      className="size-full object-contain"
                    />
                  ) : (
                    <ImagePlus className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="break-all text-sm font-medium leading-snug">
                    {logoName || "No logo selected"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG or SVG · max 1MB
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Label
                      htmlFor="company-logo"
                      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                    >
                      <Upload className="size-3.5" />
                      Upload logo
                    </Label>
                    <input
                      id="company-logo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => void onLogoChange(e)}
                    />
                    {logo ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-xl"
                        onClick={() => {
                          setLogo("");
                          setLogoName("");
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northgate Industrial Group"
                className="h-10 rounded-xl"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-industry">Industry</Label>
              <Input
                id="company-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Engineering & Facilities"
                className="h-10 rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-country">Country</Label>
              <Input
                id="company-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. United Kingdom"
                className="h-10 rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-status">Status</Label>
              <Select
                value={companyStatus}
                onValueChange={(v) => setCompanyStatusLocal(v as CompanyOption["status"])}
              >
                <SelectTrigger id="company-status" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {editing ? <Pencil /> : <Plus />}
                {saving
                  ? editing
                    ? "Saving…"
                    : "Creating…"
                  : editing
                    ? "Save changes"
                    : "Create company"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete company</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Companies" value={companies.length} icon={Building2} />
        <StatCard label="Active" value={active} icon={Building2} tone="success" />
      </div>

      <Panel
        className="mt-6"
        title="Company directory"
        description={
          rows.length === 0
            ? "0 shown"
            : `Showing ${pageStart}–${pageEnd} of ${rows.length}`
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search company, industry, country…"
              className="h-10 rounded-xl pl-9"
              aria-label="Search companies"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) =>
              setStatus(v as "All statuses" | CompanyOption["status"])
            }
          >
            <SelectTrigger className="h-10 rounded-xl" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All statuses">All statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={companies.length === 0 ? "No companies yet" : "No companies found"}
            description={
              companies.length === 0
                ? "Create a company to get started. New companies will appear in this list."
                : "Try a different search or create a new company."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Industry</TableHead>
                    <TableHead className="font-semibold">Country</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="w-12 font-semibold">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt=""
                                className="size-full object-contain"
                              />
                            ) : (
                              <Building2 className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{company.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {company.id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{company.industry || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.country || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusPill value={company.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {company.createdAt}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-lg"
                              aria-label={`Actions for ${company.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(company)}>
                              <Pencil />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(company)}>
                              <Power />
                              {company.status === "Active" ? "Mark inactive" : "Mark active"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(company)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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
