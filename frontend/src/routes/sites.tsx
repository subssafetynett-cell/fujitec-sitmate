import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileStack,
  FileText,
  FolderOpen,
  FolderPlus,
  HardHat,
  MapPin,
  MoreHorizontal,
  Pencil,
  PenTool,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilledFormDownloadMenu } from "@/components/sheq/filled-form-download";
import { FridayPackFillPage } from "@/components/sheq/friday-pack-fill-page";
import { EmptyState, PageHeader, Panel } from "@/components/sheq/primitives";
import { StatusPill } from "@/components/sheq/status-pill";
import type { Site, SitePackCategoryId, SitePackDocument } from "@/data/sheq";
import {
  ApiError,
  createSite,
  createSitePackFolder,
  deleteSite,
  deleteSitePackDocument,
  deleteSitePackFolder,
  fetchSitePack,
  setSiteStatus,
  sitePackDownloadUrl,
  updateSite,
  uploadSitePackDocument,
} from "@/lib/api";
import {
  canCreateSite,
  canManageSitePack,
  getAuthUser,
  isSiteManager,
  scopeSitesToActor,
} from "@/lib/auth";
import { useSheq } from "@/lib/sheq-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DOCS_PAGE_SIZE = 10;

export const Route = createFileRoute("/sites")({
  head: () => ({
    meta: [
      { title: "Sitemate" },
      {
        name: "description",
        content:
          "Pick a site, open a pack section, then manage folders, forms and uploads.",
      },
      { property: "og:title", content: "Sitemate" },
      {
        property: "og:description",
        content: "Simple site register and site pack document management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SitesPage,
});

const FALLBACK_CATEGORIES: {
  id: SitePackCategoryId;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "friday-pack-forms",
    label: "Friday pack forms",
    hint: "Create folders, fill templates, save forms",
    icon: CalendarDays,
  },
  {
    id: "rams",
    label: "RAMS",
    hint: "Create folders, then upload risk assessments & method statements",
    icon: ClipboardList,
  },
  {
    id: "drawings",
    label: "Drawings",
    hint: "Create folders, then upload drawings and plans",
    icon: PenTool,
  },
  {
    id: "installation-manuals",
    label: "Installation manuals",
    hint: "Create folders, then upload manuals and guides",
    icon: BookOpen,
  },
  {
    id: "training-certificates",
    label: "Training certificates",
    hint: "Create folders, then upload training evidence",
    icon: Award,
  },
  {
    id: "equipment-certificates",
    label: "Equipment certificates",
    hint: "Create folders, then upload equipment certificates",
    icon: HardHat,
  },
  {
    id: "general-uploads",
    label: "General uploads",
    hint: "Create folders, then upload other site documents",
    icon: Upload,
  },
];

const siteStatuses: Site["status"][] = ["Active", "Inactive", "Onboarding", "Suspended"];
const MAX_PACK_FILE_BYTES = 4_000_000;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function SitesPage() {
  const { sites: allSites, users, templates } = useSheq();
  const queryClient = useQueryClient();
  const currentUser = getAuthUser();
  const allowCreateSite = canCreateSite(currentUser);
  const sites = useMemo(
    () => scopeSitesToActor(currentUser, allSites),
    [currentUser, allSites],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageTab, setPageTab] = useState<"sites" | "packs">(() =>
    !allowCreateSite && isSiteManager(currentUser) ? "packs" : "sites",
  );
  const [siteQuery, setSiteQuery] = useState("");
  const [activeId, setActiveId] = useState(sites[0]?.id ?? "");
  const [activeCategory, setActiveCategory] =
    useState<SitePackCategoryId>("friday-pack-forms");
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [docsPage, setDocsPage] = useState(1);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<SitePackDocument | null>(null);
  const [packFormMode, setPackFormMode] = useState<"create" | "edit" | "view">(
    "create",
  );

  const [open, setOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Site["status"]>("Active");
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const siteManagers = useMemo(() => {
    // Only Active (verified) users — hide Invited and Suspended.
    const activeUsers = users.filter((u) => u.status === "Active");
    const preferred = activeUsers.filter(
      (u) => u.role === "Site Manager" || u.role === "Supervisor",
    );
    const pool = preferred.length > 0 ? preferred : activeUsers;
    return [...new Set(pool.map((u) => u.name))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [users]);

  const siteManagerMeta = useMemo(() => {
    const map = new Map<string, { role: string; email: string }>();
    for (const u of users) {
      map.set(u.name, { role: u.role, email: u.email });
    }
    return map;
  }, [users]);

  function managersForSite(site: Site) {
    if (Array.isArray(site.managers) && site.managers.length > 0) return site.managers;
    if (site.manager?.trim()) {
      return site.manager
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
    }
    return [];
  }

  function formatManagers(site: Site) {
    const list = managersForSite(site);
    return list.length > 0 ? list.join(", ") : "—";
  }

  function toggleManager(person: string) {
    setSelectedManagers((prev) =>
      prev.includes(person) ? prev.filter((m) => m !== person) : [...prev, person],
    );
  }

  const filteredSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) =>
      `${s.name} ${s.address} ${s.city} ${s.manager} ${(s.managers ?? []).join(" ")} ${s.status}`
        .toLowerCase()
        .includes(q),
    );
  }, [sites, siteQuery]);

  useEffect(() => {
    if (!sites.some((s) => s.id === activeId)) {
      setActiveId(sites[0]?.id ?? "");
    }
  }, [sites, activeId]);

  const active = sites.find((s) => s.id === activeId) ?? sites[0];

  const packQuery = useQuery({
    queryKey: ["site-pack", active?.id],
    queryFn: () => fetchSitePack(active!.id),
    enabled: Boolean(active?.id),
  });

  const pack = packQuery.data;
  const categories = FALLBACK_CATEGORIES.map((fallback) => {
    const live = pack?.categories.find((c) => c.id === fallback.id);
    return {
      ...fallback,
      count: live?.count ?? 0,
      folderCount: live?.folderCount ?? 0,
    };
  });

  const categoryFolders =
    pack?.folders.filter((f) => f.category === activeCategory) ?? [];
  const activeFolder = categoryFolders.find((f) => f.id === activeFolderId) ?? null;
  const unfiledCategoryDocs =
    pack?.documents.filter(
      (d) => d.category === activeCategory && !d.folderId,
    ) ?? [];
  const categoryDocs =
    pack?.documents.filter((d) => {
      if (d.category !== activeCategory) return false;
      // Files live inside folders — only show docs for the open folder.
      return activeFolderId ? d.folderId === activeFolderId : false;
    }) ?? [];
  const isFridayPack = activeCategory === "friday-pack-forms";

  const docsTotalPages = Math.max(1, Math.ceil(categoryDocs.length / DOCS_PAGE_SIZE));
  const docsCurrentPage = Math.min(docsPage, docsTotalPages);
  const pagedCategoryDocs = useMemo(
    () =>
      categoryDocs.slice(
        (docsCurrentPage - 1) * DOCS_PAGE_SIZE,
        docsCurrentPage * DOCS_PAGE_SIZE,
      ),
    [categoryDocs, docsCurrentPage],
  );
  const docsPageStart =
    categoryDocs.length === 0 ? 0 : (docsCurrentPage - 1) * DOCS_PAGE_SIZE + 1;
  const docsPageEnd = Math.min(docsCurrentPage * DOCS_PAGE_SIZE, categoryDocs.length);

  const activeCategoryMeta =
    (categories.find((c) => c.id === activeCategory) ?? categories[0])!;

  useEffect(() => {
    setActiveFolderId(null);
  }, [activeCategory]);

  useEffect(() => {
    setActiveFolderId(null);
  }, [activeId]);

  useEffect(() => {
    setDocsPage(1);
  }, [activeId, activeCategory, activeFolderId]);

  useEffect(() => {
    if (docsPage > docsTotalPages) setDocsPage(docsTotalPages);
  }, [docsPage, docsTotalPages]);

  async function refreshPack() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["site-pack", active?.id] }),
      queryClient.invalidateQueries({ queryKey: ["sheq"] }),
    ]);
  }

  function resetForm() {
    setEditingSiteId(null);
    setName("");
    setAddress("");
    setStatus("Active");
    setSelectedManagers([]);
  }

  function openAddForm() {
    setFormMode("add");
    resetForm();
    setOpen(true);
  }

  function openEditForm(site: Site) {
    setFormMode("edit");
    setEditingSiteId(site.id);
    setName(site.name);
    setAddress(site.address || site.city);
    setStatus(site.status);
    setSelectedManagers(managersForSite(site));
    setActiveId(site.id);
    setOpen(true);
  }

  async function handleSiteForm(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.message("Enter site name and address");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        status,
        managers: selectedManagers,
      };

      if (formMode === "edit" && editingSiteId) {
        const updated = await updateSite(editingSiteId, payload);
        await queryClient.invalidateQueries({ queryKey: ["sheq"] });
        setActiveId(updated.id);
        toast.success(`${updated.name} updated`);
      } else {
        const created = await createSite(payload);
        await queryClient.invalidateQueries({ queryKey: ["sheq"] });
        setActiveId(created.id);
        setActiveCategory("friday-pack-forms");
        toast.success(`${created.name} added`);
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : formMode === "edit"
            ? "Unable to update site"
            : "Unable to add site",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSiteStatus(site: Site) {
    const next = site.status === "Active" ? "Inactive" : "Active";
    try {
      const updated = await setSiteStatus(site.id, next);
      await queryClient.invalidateQueries({ queryKey: ["sheq"] });
      toast.success(
        next === "Inactive"
          ? `${updated.name} marked inactive`
          : `${updated.name} marked active`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update status");
    }
  }

  async function handleDeleteSite() {
    if (!deleteTarget) return;
    setDeletingSite(true);
    try {
      await deleteSite(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["sheq"] });
      if (activeId === deleteTarget.id) {
        setActiveId("");
      }
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete site");
    } finally {
      setDeletingSite(false);
    }
  }

  async function handleCreateFolder(e: FormEvent) {
    e.preventDefault();
    if (!active || !folderName.trim()) {
      toast.message("Enter a folder name");
      return;
    }
    setCreatingFolder(true);
    try {
      const folder = await createSitePackFolder({
        siteId: active.id,
        name: folderName.trim(),
        category: activeCategory,
      });
      await refreshPack();
      setActiveFolderId(folder.id);
      setFolderDialogOpen(false);
      setFolderName("");
      toast.success(`Folder “${folder.name}” created`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folderId: string, folderLabel: string) {
    if (!active) return;
    const ok = window.confirm(
      `Delete folder “${folderLabel}” and everything inside it? This cannot be undone.`,
    );
    if (!ok) return;

    setDeletingId(folderId);
    try {
      await deleteSitePackFolder(active.id, folderId);
      if (activeFolderId === folderId) setActiveFolderId(null);
      await refreshPack();
      toast.success(`Folder “${folderLabel}” removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to remove folder");
    } finally {
      setDeletingId(null);
    }
  }

  async function onPackFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;

    if (file.size > MAX_PACK_FILE_BYTES) {
      toast.error("File must be 4MB or smaller");
      return;
    }

    if (!activeFolderId) {
      toast.message("Open a folder first, then upload");
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Unable to read file"));
        reader.readAsDataURL(file);
      });

      await uploadSitePackDocument({
        siteId: active.id,
        category: activeCategory,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
        folderId: activeFolderId,
      });
      await refreshPack();
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string, docName: string) {
    if (!active) return;
    const ok = window.confirm(`Remove “${docName}”?`);
    if (!ok) return;

    setDeletingId(docId);
    try {
      await deleteSitePackDocument(active.id, docId);
      await refreshPack();
      toast.success(`${docName} removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to remove file");
    } finally {
      setDeletingId(null);
    }
  }

  function renderDocRow(doc: SitePackDocument) {
    if (!active) return null;
    return (
      <li
        key={doc.id}
        className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          {doc.source === "filled-form" ? (
            <FileStack className="size-4 text-muted-foreground" />
          ) : (
            <FileText className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            {doc.source === "filled-form" ? (
              <Badge variant="secondary" className="rounded-full px-2 py-0">
                Filled form
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {doc.source === "filled-form"
              ? `${doc.templateName || "Template"} · saved ${formatUploadedAt(doc.uploadedAt)}`
              : `${formatBytes(doc.size)} · uploaded ${formatUploadedAt(doc.uploadedAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {doc.source === "filled-form" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setEditingForm(doc);
                  setPackFormMode("view");
                  setFillOpen(true);
                }}
              >
                <Eye /> View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setEditingForm(doc);
                  setPackFormMode("edit");
                  setFillOpen(true);
                }}
              >
                <Pencil /> Edit
              </Button>
              <FilledFormDownloadMenu
                siteId={active.id}
                doc={doc}
                templates={templates}
              />
            </>
          ) : (
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <a href={sitePackDownloadUrl(active.id, doc.id)} download={doc.name}>
                <Download /> Download
              </a>
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg text-destructive hover:text-destructive"
            disabled={deletingId === doc.id}
            onClick={() => handleDelete(doc.id, doc.name)}
            title="Remove"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </li>
    );
  }

  function openPackForSite(site: Site) {
    setActiveId(site.id);
    setActiveCategory("friday-pack-forms");
    setActiveFolderId(null);
    setPageTab("packs");
  }

  if (fillOpen && active && activeFolder) {
    return (
      <FridayPackFillPage
        siteId={active.id}
        siteName={active.name}
        folderId={activeFolder.id}
        folderName={activeFolder.name}
        templates={templates}
        editing={editingForm}
        mode={packFormMode}
        onClose={() => {
          setFillOpen(false);
          setEditingForm(null);
          setPackFormMode("create");
        }}
        onSaved={() => {
          void refreshPack();
        }}
        onEdit={
          editingForm
            ? () => {
                setPackFormMode("edit");
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Sites & Site Packs"
        description={
          pageTab === "sites"
            ? allowCreateSite
              ? "Create and edit sites, assign site managers, then open Site pack management."
              : "Sites assigned to you. Open Manage pack to work on site pack documents."
            : "Choose a site, open a pack section, then add folders, fill forms or upload files."
        }
        actions={
          pageTab === "sites" ? (
            allowCreateSite ? (
              <Button className="rounded-xl" onClick={openAddForm}>
                <Plus /> Add site
              </Button>
            ) : null
          ) : active ? (
            <Button
              className="rounded-xl"
              variant="outline"
              onClick={() => setPageTab("sites")}
            >
              <Building2 /> View sites
            </Button>
          ) : null
        }
      />

      <Tabs
        value={pageTab}
        onValueChange={(v) => setPageTab(v as "sites" | "packs")}
      >
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-xl p-1 sm:w-auto">
          <TabsTrigger
            value="sites"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
          >
            <Building2 className="size-3.5" />
            Sites
          </TabsTrigger>
          <TabsTrigger
            value="packs"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm"
          >
            <FolderOpen className="size-3.5" />
            Site pack management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-0">
          <Panel
            title="Site register"
            description={
              allowCreateSite
                ? `${sites.length} site${sites.length === 1 ? "" : "s"} · add, edit, or open a site pack`
                : `${sites.length} site${sites.length === 1 ? "" : "s"} assigned to you`
            }
          >
            <div className="relative mb-4 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={siteQuery}
                onChange={(e) => setSiteQuery(e.target.value)}
                placeholder="Search by name, address, manager…"
                aria-label="Search sites"
                className="h-10 rounded-xl bg-background pl-9"
              />
            </div>

            {sites.length === 0 ? (
              <EmptyState
                icon={<Building2 />}
                title={allowCreateSite ? "No sites yet" : "No sites assigned"}
                description={
                  allowCreateSite
                    ? "Add your first site and select site managers so they can manage its pack."
                    : "You are not assigned as a site manager on any site yet. Ask a Company Admin or Super Admin to add you when creating or editing a site."
                }
                action={
                  allowCreateSite ? (
                    <Button className="rounded-xl" onClick={openAddForm}>
                      <Plus /> Add site
                    </Button>
                  ) : undefined
                }
              />
            ) : filteredSites.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No sites match “{siteQuery}”.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Sl No</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Site managers</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Pack items</TableHead>
                      <TableHead className="w-12 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSites.map((s, index) => (
                      <TableRow key={s.id}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground">
                          {s.address || s.city}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="line-clamp-2">{formatManagers(s)}</span>
                        </TableCell>
                        <TableCell>
                          <StatusPill value={s.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.packItems}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-lg"
                                aria-label={`Actions for ${s.name}`}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canManageSitePack(currentUser, s) ? (
                                <DropdownMenuItem onClick={() => openPackForSite(s)}>
                                  <FolderOpen /> Manage pack
                                </DropdownMenuItem>
                              ) : null}
                              {allowCreateSite ? (
                                <>
                                  <DropdownMenuItem onClick={() => openEditForm(s)}>
                                    <Pencil /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleSiteStatus(s)}>
                                    <Power />
                                    {s.status === "Active"
                                      ? "Mark inactive"
                                      : "Mark active"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(s)}
                                  >
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="packs" className="mt-0">
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              title="Working site"
              description="Pick which site’s pack you want to manage"
            >
              {sites.length === 0 ? (
                <EmptyState
                  icon={<Building2 />}
                  title="No sites available"
                  description={
                    allowCreateSite
                      ? "Add a site first, then come back to manage its pack."
                      : "No sites are assigned to you yet. Ask an admin to select you as a site manager."
                  }
                  action={
                    allowCreateSite ? (
                      <Button
                        className="rounded-xl"
                        onClick={() => {
                          setPageTab("sites");
                          openAddForm();
                        }}
                      >
                        <Plus /> Add site
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="pack-site">Site</Label>
                    <Select
                      value={active?.id ?? ""}
                      onValueChange={(id) => {
                        setActiveId(id);
                        setActiveCategory("friday-pack-forms");
                        setActiveFolderId(null);
                      }}
                    >
                      <SelectTrigger id="pack-site" className="h-10 rounded-xl">
                        <SelectValue placeholder="Select a site" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {active ? (
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2">
                        <MapPin className="size-3.5" />
                        <span className="max-w-[200px] truncate">
                          {active.address || active.city}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2">
                        <UserRound className="size-3.5 shrink-0" />
                        <span className="max-w-[260px] truncate">{formatManagers(active)}</span>
                      </span>
                      <StatusPill value={active.status} />
                    </div>
                  ) : null}
                </div>
              )}
            </Panel>

            {!active ? null : (
              <>
                <Panel title="Pack sections" description={activeCategoryMeta.hint}>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => {
                      const selected = activeCategory === c.id;
                      // Badge shows folder count so each tab reads as a folder section.
                      const count = c.folderCount;
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveCategory(c.id)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:border-ring",
                          )}
                        >
                          <Icon className="size-3.5 shrink-0 opacity-90" />
                          <span>{c.label}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                              selected
                                ? "bg-primary-foreground/20"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title={activeFolder ? activeFolder.name : activeCategoryMeta.label}
                  description={
                    activeFolder
                      ? isFridayPack
                        ? "Fill a template or upload a file into this folder"
                        : "Upload files into this folder"
                      : "Create a folder, open it, then upload files"
                  }
                  actions={
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={onPackFileChange}
                      />
                      {activeFolder ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setActiveFolderId(null)}
                          >
                            <ArrowLeft /> All folders
                          </Button>
                          {isFridayPack ? (
                            <Button
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setEditingForm(null);
                                setPackFormMode("create");
                                setFillOpen(true);
                              }}
                            >
                              <FileStack /> Fill form
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant={isFridayPack ? "outline" : "default"}
                            className="rounded-xl"
                            disabled={uploading || packQuery.isLoading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload />
                            {uploading ? "Uploading…" : "Upload"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => {
                            setFolderName("");
                            setFolderDialogOpen(true);
                          }}
                        >
                          <FolderPlus /> New folder
                        </Button>
                      )}
                    </>
                  }
                >
                  <nav
                    aria-label="Pack location"
                    className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{active.name}</span>
                    <ChevronRight className="size-3.5" />
                    <button
                      type="button"
                      className={cn(
                        "rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground",
                        !activeFolder && "font-medium text-foreground",
                      )}
                      onClick={() => setActiveFolderId(null)}
                    >
                      {activeCategoryMeta.label}
                    </button>
                    {activeFolder ? (
                      <>
                        <ChevronRight className="size-3.5" />
                        <span className="font-medium text-foreground">
                          {activeFolder.name}
                        </span>
                      </>
                    ) : null}
                  </nav>

                  {packQuery.isLoading ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Loading pack…
                    </p>
                  ) : packQuery.isError ? (
                    <EmptyState
                      icon={<FileText />}
                      title="Couldn’t load this pack"
                      description="Check the API connection, then try again."
                      action={
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => packQuery.refetch()}
                        >
                          Retry
                        </Button>
                      }
                    />
                  ) : !activeFolder ? (
                    categoryFolders.length === 0 ? (
                      <EmptyState
                        icon={<FolderPlus />}
                        title="Start with a folder"
                        description={
                          isFridayPack
                            ? "Example: “Week 31 pack”. Then open it to fill forms or upload files."
                            : `Create a folder for ${activeCategoryMeta.label.toLowerCase()}, then open it to upload files.`
                        }
                        action={
                          <Button
                            className="rounded-xl"
                            onClick={() => {
                              setFolderName("");
                              setFolderDialogOpen(true);
                            }}
                          >
                            <FolderPlus /> Create first folder
                          </Button>
                        }
                      />
                    ) : (
                      <div className="grid gap-5">
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {categoryFolders.map((folder) => {
                            const count =
                              pack?.documents.filter((d) => d.folderId === folder.id)
                                .length ?? 0;
                            return (
                              <li key={folder.id}>
                                <div className="flex items-stretch overflow-hidden rounded-2xl border border-border">
                                  <button
                                    type="button"
                                    onClick={() => setActiveFolderId(folder.id)}
                                    className="flex min-w-0 flex-1 items-center gap-3 p-4 text-left hover:bg-muted/40"
                                  >
                                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                                      <FolderOpen className="size-4 text-muted-foreground" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium">
                                        {folder.name}
                                      </span>
                                      <span className="mt-0.5 block text-xs text-muted-foreground">
                                        {count} item{count === 1 ? "" : "s"}
                                        {isFridayPack
                                          ? " · Open to fill forms"
                                          : " · Open to upload"}
                                      </span>
                                    </span>
                                    <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                                  </button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="m-2 size-8 shrink-0 self-center rounded-lg text-destructive hover:text-destructive"
                                    disabled={deletingId === folder.id}
                                    title="Delete folder"
                                    onClick={() =>
                                      handleDeleteFolder(folder.id, folder.name)
                                    }
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {unfiledCategoryDocs.length > 0 ? (
                          <div className="grid gap-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Older uploads (not in a folder)
                            </p>
                            <ul className="flex flex-col gap-2">
                              {unfiledCategoryDocs.map((doc) => renderDocRow(doc))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : categoryDocs.length === 0 ? (
                    <EmptyState
                      icon={isFridayPack ? <FileStack /> : <Upload />}
                      title="This folder is empty"
                      description={
                        isFridayPack
                          ? "Fill a site form from a template, or upload a file."
                          : `Upload documents for ${activeCategoryMeta.label.toLowerCase()}.`
                      }
                      action={
                        <div className="flex flex-wrap justify-center gap-2">
                          {isFridayPack ? (
                            <Button
                              className="rounded-xl"
                              onClick={() => {
                                setEditingForm(null);
                                setPackFormMode("create");
                                setFillOpen(true);
                              }}
                            >
                              <FileStack /> Fill form
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload /> Upload file
                          </Button>
                        </div>
                      }
                    />
                  ) : (
                    <div className="grid gap-4">
                      <ul className="flex flex-col gap-2">
                        {pagedCategoryDocs.map((doc) => renderDocRow(doc))}
                      </ul>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Showing {docsPageStart}–{docsPageEnd} of {categoryDocs.length}
                          {" · "}
                          Page {docsCurrentPage} of {docsTotalPages}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl"
                            disabled={docsCurrentPage <= 1}
                            onClick={() => setDocsPage((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="size-4" />
                            Previous
                          </Button>
                          <div className="flex flex-wrap items-center gap-1">
                            {Array.from({ length: docsTotalPages }, (_, i) => i + 1).map(
                              (pageNumber) => (
                                <Button
                                  key={pageNumber}
                                  type="button"
                                  size="sm"
                                  variant={
                                    pageNumber === docsCurrentPage ? "default" : "outline"
                                  }
                                  className="size-9 rounded-xl p-0"
                                  aria-label={`Go to page ${pageNumber}`}
                                  aria-current={
                                    pageNumber === docsCurrentPage ? "page" : undefined
                                  }
                                  onClick={() => setDocsPage(pageNumber)}
                                >
                                  {pageNumber}
                                </Button>
                              ),
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl"
                            disabled={docsCurrentPage >= docsTotalPages}
                            onClick={() =>
                              setDocsPage((p) => Math.min(docsTotalPages, p + 1))
                            }
                          >
                            Next
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit site" : "Add site"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update the site details used across the site pack."
                : "Add a site, then open Site pack management to organise its documents."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSiteForm} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riverside Plant"
                className="h-10 rounded-xl"
                autoFocus
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-address">Site address</Label>
              <Input
                id="site-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 88 Canal Road, Leeds LS1 4DY"
                className="h-10 rounded-xl"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="site-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Site["status"])}
              >
                <SelectTrigger id="site-status" className="h-10 rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {siteStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Site managers <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <p className="text-xs text-muted-foreground">
                Optional. Only active users are listed. Selected people will see this site and can manage its pack.
              </p>
              {siteManagers.length > 0 ? (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                  {siteManagers.map((m) => {
                    const checked = selectedManagers.includes(m);
                    const meta = siteManagerMeta.get(m);
                    const id = `site-manager-${m.replace(/\s+/g, "-").toLowerCase()}`;
                    return (
                      <label
                        key={m}
                        htmlFor={id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60",
                          checked && "bg-muted/50",
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={() => toggleManager(m)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{m}</span>
                          {meta ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {meta.role}
                              {meta.email ? ` · ${meta.email}` : ""}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  No users available. Invite a Site Manager from the Users page first.
                </p>
              )}
              {selectedManagers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedManagers.map((m) => (
                    <Badge
                      key={m}
                      variant="secondary"
                      className="cursor-pointer rounded-full px-2.5 py-0.5"
                      onClick={() => toggleManager(m)}
                      title="Remove"
                    >
                      {m}
                      <span className="ml-1 opacity-60">×</span>
                    </Badge>
                  ))}
                </div>
              ) : null}
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
                {formMode === "edit" ? <Pencil /> : <Plus />}
                {saving
                  ? formMode === "edit"
                    ? "Saving…"
                    : "Adding…"
                  : formMode === "edit"
                    ? "Save changes"
                    : "Add site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderDialogOpen}
        onOpenChange={(next) => {
          setFolderDialogOpen(next);
          if (!next) setFolderName("");
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a folder in {activeCategoryMeta.label} for{" "}
              {active?.name ?? "this site"}, then open it to upload files.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pack-folder-name">Folder name</Label>
              <Input
                id="pack-folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={
                  isFridayPack ? "e.g. Week 31 pack" : "e.g. Block A / July 2026"
                }
                className="h-10 rounded-xl"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFolderDialogOpen(false)}
                disabled={creatingFolder}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={creatingFolder}>
                <FolderPlus />
                {creatingFolder ? "Creating…" : "Create folder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deletingSite) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete site</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              This also removes its site pack documents and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeleteTarget(null)}
              disabled={deletingSite}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={handleDeleteSite}
              disabled={deletingSite}
            >
              <Trash2 />
              {deletingSite ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
