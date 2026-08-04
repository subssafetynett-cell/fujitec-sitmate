import { Router } from "express";
import {
  activities,
  audits,
  company,
  concernWorkflow,
  disciplineTrend,
  formFieldTypes,
  kpiGroups,
  kpiMonths,
  monthlyAudits,
  ncTrend,
  overview,
  upcomingAudits,
} from "../data/sheq.js";
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  setCompanyStatus,
  updateCompany,
} from "../data/companies-store.js";
import { getKpiStatYear, listKpiStatYears, saveKpiStatYear } from "../data/kpi-stats-store.js";
import {
  countSitePackDocuments,
  createSitePackFolder,
  deleteAllPacksForSite,
  deleteSitePackDocument,
  deleteSitePackFolder,
  getSitePackDocument,
  getSitePackFile,
  getSitePackSummary,
  listSitePackCategories,
  saveFilledForm,
  updateFilledForm,
  uploadSitePackDocument,
} from "../data/site-packs-store.js";
import {
  createSite,
  deleteSite,
  getSite,
  listSites,
  scopeSitesForActor,
  setSitePackItemCount,
  setSiteStatus,
  siteManagerNames,
  SITE_STATUSES,
  updateSite,
  userManagesSite,
} from "../data/sites-store.js";
import {
  createToolboxTalkTemplate,
  listTemplates,
} from "../data/templates-store.js";
import {
  buildConcernDownloadHtml,
  createConcern,
  deleteConcern,
  getConcern,
  listConcerns,
  updateConcern,
} from "../data/concerns-store.js";
import {
  buildSheqFormDownloadHtml,
  createSheqForm,
  deleteSheqForm,
  getSheqForm,
  listSheqForms,
  updateSheqForm,
} from "../data/sheq-forms-store.js";
import {
  approveNcResponse,
  approveNonConformance,
  computeNcByDepartment,
  computeNcDashboard,
  createNonConformance,
  getNonConformance,
  listNonConformances,
  NC_STATUSES,
  NC_WORKFLOW,
  rejectNcResponse,
  rejectNonConformance,
  saveNcResponse,
  updateNonConformanceDraft,
} from "../data/nonconformances-store.js";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  notificationBus,
  unreadCountForUser,
} from "../data/notifications-store.js";
import {
  isCloudinaryConfigured,
  uploadBuffer,
  uploadDataUrl,
} from "../lib/cloudinary.js";
import {
  getSessionUser,
  loginWithPassword,
  logoutSession,
  signupWithPassword,
} from "../data/auth-store.js";
import {
  changeOwnPassword,
  deleteUser,
  getUser,
  inviteUser,
  listUsers,
  syncUsersSiteAssignment,
  updateUser,
  USER_ROLES,
} from "../data/users-store.js";

function bearerToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || undefined;
}

function userMutationErrorStatus(message: string) {
  return message.includes("already exists") ||
    message.includes("required") ||
    message.includes("Invalid") ||
    message.includes("valid") ||
    message.includes("Password") ||
    message.includes("Select") ||
    message.includes("permission") ||
    message.includes("assign")
    ? 400
    : message.includes("not found")
      ? 404
      : message.includes("authenticated") || message.includes("Access denied")
        ? 403
        : 500;
}

async function requireActor(
  req: { headers: { authorization?: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  allowed: Array<"Super Admin" | "Company Admin">,
) {
  const actor = await getSessionUser(bearerToken(req));
  if (!actor) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if (!allowed.includes(actor.role as "Super Admin" | "Company Admin")) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return actor;
}

async function requireAnyUser(
  req: { headers: { authorization?: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const actor = await getSessionUser(bearerToken(req));
  if (!actor) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return actor;
}

function assertAssignableRole(
  actorRole: string,
  targetRole: string,
): void {
  if (targetRole === "Super Admin" && actorRole !== "Super Admin") {
    throw new Error("Only Super Admins can assign the Super Admin role");
  }
}

function sameCompany(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function scopeUsersForActor(
  actor: { role: string; company: string } | null,
  users: Awaited<ReturnType<typeof listUsers>>,
) {
  if (!actor || actor.role === "Super Admin") return users;
  return users.filter((u) => sameCompany(u.company, actor.company));
}

function assertCompanyAccess(
  actor: { role: string; company: string },
  company: string,
) {
  if (actor.role === "Super Admin") return;
  if (!sameCompany(actor.company, company)) {
    throw new Error("You can only manage users in your own company");
  }
}

async function requireSiteAccess(
  req: { headers: { authorization?: string }; params: { id: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const actor = await getSessionUser(bearerToken(req));
  if (!actor) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const site = await getSite(req.params.id);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return null;
  }
  if (!userManagesSite(actor, site)) {
    res.status(403).json({ error: "Access denied for this site" });
    return null;
  }
  return { actor, site };
}

export const sheqRouter = Router();

sheqRouter.get("/", async (req, res) => {
  const actor = await getSessionUser(bearerToken(req));
  const [companies, allSites, templates, concerns, sheqForms, allUsers, ncItems] =
    await Promise.all([
      listCompanies(),
      listSites(),
      listTemplates(),
      listConcerns(),
      listSheqForms(),
      listUsers(),
      listNonConformances(actor),
    ]);
  const users = scopeUsersForActor(actor, allUsers);
  const sites = scopeSitesForActor(actor, allSites);
  const scopedCompanies =
    !actor || actor.role === "Super Admin"
      ? companies
      : companies.filter((c) => sameCompany(c.name, actor.company));
  const usersById = new Map(allUsers.map((u) => [u.id, u]));
  const scopedForms =
    !actor || actor.role === "Super Admin"
      ? sheqForms
      : sheqForms.filter((f) => {
          if (f.company && sameCompany(f.company, actor.company)) return true;
          if (f.createdById) {
            const owner = usersById.get(f.createdById);
            if (owner && sameCompany(owner.company, actor.company)) return true;
          }
          return false;
        });
  const companyUserNames = new Set(
    users.map((u) => u.name.trim().toLowerCase()).filter(Boolean),
  );
  const scopedConcerns =
    !actor || actor.role === "Super Admin"
      ? concerns
      : concerns.filter(
          (c) =>
            c.anonymous ||
            companyUserNames.has(String(c.reporter ?? "").trim().toLowerCase()),
        );
  const sitesWithPacks = await Promise.all(
    sites.map(async (s) => ({
      ...s,
      packItems: await countSitePackDocuments(s.id),
    })),
  );
  const openNc = ncItems.filter((n) => n.status !== "Closed" && n.status !== "Rejected").length;
  const closedNc = ncItems.filter((n) => n.status === "Closed").length;
  const userNotifications = actor
    ? await listNotificationsForUser(actor.id)
    : [];
  res.json({
    company,
    companies: scopedCompanies,
    overview: {
      ...overview,
      companies: scopedCompanies.length,
      users: users.length,
      activeUsers: users.filter((u) => u.status === "Active").length,
      sites: sites.length,
      openNonConformances: openNc,
      closedNonConformances: closedNc,
    },
    monthlyAudits,
    disciplineTrend,
    ncTrend,
    sites: sitesWithPacks,
    sitePerformance: sites.map((s) => ({
      name: s.name.split(" ")[0],
      score: s.compliance,
    })),
    audits,
    templates,
    nonConformances: ncItems,
    ncStages: NC_STATUSES,
    ncWorkflow: NC_WORKFLOW,
    ncByDepartment: computeNcByDepartment(ncItems),
    concerns: scopedConcerns,
    concernWorkflow,
    sheqForms: scopedForms,
    kpiGroups,
    kpiMonths,
    activities,
    notifications: userNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      detail: n.message,
      when: n.createdAt,
      unread: !n.isRead,
      type: n.type,
      referenceType: n.referenceType,
      referenceId: n.referenceId,
    })),
    upcomingAudits,
    formFieldTypes,
    users,
  });
});

sheqRouter.get("/company", (_req, res) => {
  res.json(company);
});

sheqRouter.get("/overview", (_req, res) => {
  res.json(overview);
});

sheqRouter.get("/sites", async (req, res) => {
  const actor = await getSessionUser(bearerToken(req));
  const sites = scopeSitesForActor(actor, await listSites());
  res.json(
    await Promise.all(
      sites.map(async (s) => ({
        ...s,
        packItems: await countSitePackDocuments(s.id),
      })),
    ),
  );
});

sheqRouter.post("/sites", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const { name, address, status, manager, managers } = req.body ?? {};
    const site = await createSite({ name, address, status, manager, managers });
    await syncUsersSiteAssignment(siteManagerNames(site), site.name);
    res.status(201).json(site);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create site";
    const statusCode =
      message.includes("required") ||
      message.includes("already exists") ||
      message.includes("valid") ||
      message.includes("Select at least")
        ? 400
        : 500;
    res.status(statusCode).json({ error: message, statuses: SITE_STATUSES });
  }
});

sheqRouter.put("/sites/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const existing = await getSite(req.params.id);
    const previousManagers = existing ? siteManagerNames(existing) : [];
    const { name, address, status, manager, managers } = req.body ?? {};
    const site = await updateSite(req.params.id, { name, address, status, manager, managers });
    await syncUsersSiteAssignment(siteManagerNames(site), site.name, previousManagers);
    res.json({
      ...site,
      packItems: await countSitePackDocuments(site.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update site";
    const statusCode =
      message.includes("required") ||
      message.includes("already exists") ||
      message.includes("valid") ||
      message.includes("Select at least")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message, statuses: SITE_STATUSES });
  }
});

sheqRouter.patch("/sites/:id/status", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const status = req.body?.status;
    if (!SITE_STATUSES.includes(status)) {
      res.status(400).json({ error: "Select a valid status", statuses: SITE_STATUSES });
      return;
    }
    const site = await setSiteStatus(req.params.id, status);
    res.json({
      ...site,
      packItems: await countSitePackDocuments(site.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update site status";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

sheqRouter.delete("/sites/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    await deleteAllPacksForSite(req.params.id);
    await deleteSite(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete site";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

sheqRouter.get("/sites/:id", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  res.json({
    ...access.site,
    packItems: await countSitePackDocuments(access.site.id),
  });
});

sheqRouter.get("/site-pack-categories", (_req, res) => {
  res.json(listSitePackCategories());
});

sheqRouter.get("/sites/:id/pack", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  res.json(await getSitePackSummary(access.site.id));
});

sheqRouter.post("/sites/:id/pack", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  try {
    const site = access.site;
    const { category, name, mimeType, dataUrl, folderId } = req.body ?? {};
    const doc = await uploadSitePackDocument({
      siteId: site.id,
      category,
      name,
      mimeType,
      dataUrl,
      folderId,
    });
    await setSitePackItemCount(site.id, await countSitePackDocuments(site.id));
    res.status(201).json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to upload document";
    const statusCode =
      message.includes("required") ||
      message.includes("valid") ||
      message.includes("too large") ||
      message.includes("empty") ||
      message.includes("Upload") ||
      message.includes("mismatch")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.post("/sites/:id/pack/folders", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  try {
    const site = access.site;
    const { name, category } = req.body ?? {};
    const folder = await createSitePackFolder({
      siteId: site.id,
      category: category || "friday-pack-forms",
      name,
    });
    res.status(201).json(folder);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create folder";
    const statusCode =
      message.includes("required") ||
      message.includes("already exists") ||
      message.includes("valid") ||
      message.includes("only be created")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.delete("/sites/:id/pack/folders/:folderId", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  const site = access.site;
  const ok = await deleteSitePackFolder(site.id, req.params.folderId);
  if (!ok) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  await setSitePackItemCount(site.id, await countSitePackDocuments(site.id));
  res.status(204).end();
});

sheqRouter.post("/sites/:id/pack/forms", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  try {
    const site = access.site;
    const { folderId, templateId, templateName, kind, title, formData, documentNo, code, approvedBy } = req.body ?? {};
    const doc = await saveFilledForm({
      siteId: site.id,
      folderId,
      templateId,
      templateName,
      kind,
      title,
      formData,
      documentNo,
      code,
      approvedBy,
    });
    await setSitePackItemCount(site.id, await countSitePackDocuments(site.id));
    res.status(201).json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to save form";
    const statusCode =
      message.includes("required") || message.includes("only be saved")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.put("/sites/:id/pack/forms/:docId", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  try {
    const site = access.site;
    const { title, formData } = req.body ?? {};
    const doc = await updateFilledForm(site.id, req.params.docId, { title, formData });
    res.json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update form";
    const statusCode =
      message.includes("required")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.get("/sites/:id/pack/forms/:docId", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  const site = access.site;
  const doc = await getSitePackDocument(site.id, req.params.docId);
  if (!doc || doc.source !== "filled-form") {
    res.status(404).json({ error: "Filled form not found" });
    return;
  }
  res.json(doc);
});

sheqRouter.get("/sites/:id/pack/:docId/download", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  const file = await getSitePackFile(access.site.id, req.params.docId);
  if (!file) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (file.redirectUrl) {
    res.redirect(file.redirectUrl);
    return;
  }
  const filename =
    file.doc.source === "filled-form"
      ? `${file.doc.name.replace(/"/g, "")}.json`
      : file.doc.name.replace(/"/g, "");
  res.setHeader("Content-Type", file.doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(file.buffer);
});

sheqRouter.delete("/sites/:id/pack/:docId", async (req, res) => {
  const access = await requireSiteAccess(req, res);
  if (!access) return;
  const site = access.site;
  const ok = await deleteSitePackDocument(site.id, req.params.docId);
  if (!ok) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await setSitePackItemCount(site.id, await countSitePackDocuments(site.id));
  res.status(204).end();
});

sheqRouter.get("/uploads/status", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  res.json({
    configured: isCloudinaryConfigured(),
    provider: isCloudinaryConfigured() ? "cloudinary" : "local",
  });
});

/**
 * Upload an image/file to Cloudinary.
 * Body: { dataUrl: string, folder?: string, filename?: string, resourceType?: "image"|"raw"|"auto" }
 */
sheqRouter.post("/uploads", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;

  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) to the environment.",
    });
    return;
  }

  try {
    const dataUrl = String(req.body?.dataUrl ?? "").trim();
    const folder = String(req.body?.folder ?? "sheq-harmony").trim() || "sheq-harmony";
    const filename =
      typeof req.body?.filename === "string" ? req.body.filename.trim() : undefined;
    const resourceTypeRaw = String(req.body?.resourceType ?? "auto").trim();
    const resourceType =
      resourceTypeRaw === "image" ||
      resourceTypeRaw === "raw" ||
      resourceTypeRaw === "video" ||
      resourceTypeRaw === "auto"
        ? resourceTypeRaw
        : "auto";

    if (!dataUrl.startsWith("data:")) {
      res.status(400).json({ error: "Upload a valid file (data URL required)" });
      return;
    }

    const comma = dataUrl.indexOf(",");
    if (comma < 0) {
      res.status(400).json({ error: "Upload a valid file" });
      return;
    }
    const meta = dataUrl.slice(0, comma);
    const base64 = dataUrl.slice(comma + 1);
    if (!meta.includes(";base64") || !base64) {
      res.status(400).json({ error: "Upload a valid file" });
      return;
    }

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) {
      res.status(400).json({ error: "File is empty" });
      return;
    }
    if (buffer.length > 8_000_000) {
      res.status(400).json({ error: "File is too large (max 8MB)" });
      return;
    }

    // Prefer stream upload for large files; data URL path is fine for logos.
    const uploaded =
      buffer.length > 1_500_000
        ? await uploadBuffer(buffer, { folder, filename, resourceType })
        : await uploadDataUrl(dataUrl, { folder, filename, resourceType });

    res.status(201).json(uploaded);
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unable to upload file",
    });
  }
});

sheqRouter.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "");
    const password = String(req.body?.password ?? "");
    const result = await loginWithPassword(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({
      error: err instanceof Error ? err.message : "Unable to sign in",
    });
  }
});

sheqRouter.post("/auth/signup", async (req, res) => {
  try {
    const result = await signupWithPassword({
      name: String(req.body?.name ?? ""),
      email: String(req.body?.email ?? ""),
      mobile: typeof req.body?.mobile === "string" ? req.body.mobile : undefined,
      company: String(req.body?.company ?? ""),
      password: String(req.body?.password ?? ""),
    });
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create account";
    res.status(userMutationErrorStatus(message)).json({
      error: message,
      companies: await listCompanies(),
    });
  }
});

sheqRouter.get("/auth/me", async (req, res) => {
  const user = await getSessionUser(bearerToken(req));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user });
});

sheqRouter.post("/auth/logout", async (req, res) => {
  await logoutSession(bearerToken(req));
  res.status(204).end();
});

sheqRouter.put("/auth/password", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    await changeOwnPassword(
      actor.id,
      String(body.currentPassword ?? ""),
      String(body.newPassword ?? ""),
    );
    res.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update password";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.get("/users", async (req, res) => {
  const actor = await getSessionUser(bearerToken(req));
  res.json(scopeUsersForActor(actor, await listUsers()));
});

sheqRouter.post("/users", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const { name, email, mobile, company, password, role } = req.body ?? {};
    const resolvedCompany =
      actor.role === "Company Admin" ? actor.company : String(company ?? "");
    assertCompanyAccess(actor, resolvedCompany);
    assertAssignableRole(actor.role, String(role ?? ""));
    const user = await inviteUser({
      name,
      email,
      mobile,
      company: resolvedCompany,
      password,
      role,
    });
    res.status(201).json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to invite user";
    res.status(userMutationErrorStatus(message)).json({
      error: message,
      roles: USER_ROLES,
      companies: await listCompanies(),
    });
  }
});

sheqRouter.get("/users/:id", async (req, res) => {
  const actor = await getSessionUser(bearerToken(req));
  const user = await getUser(req.params.id);
  if (!user || (actor && !scopeUsersForActor(actor, [user]).length)) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

sheqRouter.put("/users/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const existing = await getUser(req.params.id);
    if (!existing) throw new Error("User not found");
    assertCompanyAccess(actor, existing.company);

    const { name, email, mobile, company, password, role, status } = req.body ?? {};
    const resolvedCompany =
      actor.role === "Company Admin" ? actor.company : String(company ?? existing.company);
    assertCompanyAccess(actor, resolvedCompany);
    assertAssignableRole(actor.role, String(role ?? ""));
    const user = await updateUser(req.params.id, {
      name,
      email,
      mobile,
      company: resolvedCompany,
      password,
      role,
      status,
    });
    res.json(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update user";
    res.status(userMutationErrorStatus(message)).json({
      error: message,
      roles: USER_ROLES,
      companies: await listCompanies(),
    });
  }
});

sheqRouter.delete("/users/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const existing = await getUser(req.params.id);
    if (!existing) throw new Error("User not found");
    assertCompanyAccess(actor, existing.company);
    await deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete user";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

sheqRouter.get("/companies", async (_req, res) => {
  res.json(await listCompanies());
});

sheqRouter.post("/companies", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin"]);
  if (!actor) return;
  try {
    const { name, industry, country, logo, status } = req.body ?? {};
    const created = await createCompany({ name, industry, country, logo, status });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create company";
    const statusCode =
      message.includes("required") ||
      message.includes("already exists") ||
      message.includes("Logo") ||
      message.includes("image")
        ? 400
        : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.put("/companies/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin"]);
  if (!actor) return;
  try {
    const { name, industry, country, logo, status } = req.body ?? {};
    const updated = await updateCompany(req.params.id, { name, industry, country, logo, status });
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update company";
    const statusCode =
      message.includes("required") ||
      message.includes("already exists") ||
      message.includes("Logo") ||
      message.includes("image")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.patch("/companies/:id/status", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin"]);
  if (!actor) return;
  try {
    const status = req.body?.status;
    if (status !== "Active" && status !== "Inactive") {
      res.status(400).json({ error: "Select a valid status" });
      return;
    }
    const updated = await setCompanyStatus(req.params.id, status);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update company status";
    const statusCode = message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.delete("/companies/:id", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin"]);
  if (!actor) return;
  try {
    await deleteCompany(req.params.id);
    res.status(204).end();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete company";
    const statusCode = message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.get("/audits", (_req, res) => {
  res.json(audits);
});

sheqRouter.get("/audits/:id", (req, res) => {
  const audit = audits.find((a) => a.id === req.params.id);
  if (!audit) {
    res.status(404).json({ error: "Audit not found" });
    return;
  }
  res.json(audit);
});

sheqRouter.get("/templates", async (_req, res) => {
  res.json(await listTemplates());
});

sheqRouter.post("/templates/toolbox-talk", async (req, res) => {
  try {
    const { name, logoLeft, logoRight, documentNo, approvedBy, status } = req.body ?? {};
    const created = await createToolboxTalkTemplate({
      name,
      logoLeft,
      logoRight,
      documentNo,
      approvedBy,
      status,
    });
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create template";
    const statusCode =
      message.includes("Logo") || message.includes("image") || message.includes("large")
        ? 400
        : 500;
    res.status(statusCode).json({ error: message });
  }
});

sheqRouter.get("/templates/:id", async (req, res) => {
  const templates = await listTemplates();
  const template = templates.find((t) => t.id === req.params.id);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(template);
});

sheqRouter.get("/non-conformances", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const items = await listNonConformances(actor);
  res.json({
    items,
    stages: NC_STATUSES,
    workflow: NC_WORKFLOW,
    byDepartment: computeNcByDepartment(items),
    dashboard: computeNcDashboard(items, actor.role),
  });
});

sheqRouter.get("/non-conformances/dashboard", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const items = await listNonConformances(actor);
  res.json(computeNcDashboard(items, actor.role));
});

sheqRouter.get("/non-conformances/:id", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const item = await getNonConformance(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Non-conformance not found" });
    return;
  }
  const visible = (await listNonConformances(actor)).some((n) => n.id === item.id);
  if (!visible) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  res.json(item);
});

sheqRouter.post("/non-conformances", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const created = await createNonConformance({
      actor,
      templateId: String(body.templateId ?? ""),
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      responsiblePersonId: String(body.responsiblePersonId ?? ""),
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      auditRef: typeof body.auditRef === "string" ? body.auditRef : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
      evidence: Array.isArray(body.evidence) ? body.evidence : undefined,
    });
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create NC";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.put("/non-conformances/:id", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await updateNonConformanceDraft({
      id: req.params.id,
      actor,
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      responsiblePersonId:
        typeof body.responsiblePersonId === "string"
          ? body.responsiblePersonId
          : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
      evidence: Array.isArray(body.evidence) ? body.evidence : undefined,
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update NC";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.post("/non-conformances/:id/approve", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await approveNonConformance(
      req.params.id,
      actor,
      typeof body.comments === "string" ? body.comments : undefined,
    );
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve NC";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.post("/non-conformances/:id/reject", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await rejectNonConformance(
      req.params.id,
      actor,
      String(body.reason ?? ""),
    );
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject NC";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.post("/non-conformances/:id/response", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await saveNcResponse({
      id: req.params.id,
      actor,
      correction: String(body.correction ?? ""),
      rootCause: String(body.rootCause ?? ""),
      correctiveAction: String(body.correctiveAction ?? ""),
      evidence: Array.isArray(body.evidence) ? body.evidence : undefined,
      submit: Boolean(body.submit),
    });
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save response";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.post("/non-conformances/:id/review-approve", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await approveNcResponse(
      req.params.id,
      actor,
      typeof body.comments === "string" ? body.comments : undefined,
    );
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve response";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.post("/non-conformances/:id/review-reject", async (req, res) => {
  const actor = await requireActor(req, res, ["Super Admin", "Company Admin"]);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const updated = await rejectNcResponse(
      req.params.id,
      actor,
      String(body.comments ?? ""),
    );
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reject response";
    res.status(userMutationErrorStatus(message)).json({ error: message });
  }
});

sheqRouter.get("/concerns", async (_req, res) => {
  res.json({
    items: await listConcerns(),
    workflow: concernWorkflow,
  });
});

sheqRouter.post("/concerns", async (req, res) => {
  try {
    const body = req.body ?? {};
    const created = await createConcern({
      templateId: String(body.templateId ?? ""),
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      anonymous: Boolean(body.anonymous),
      reporter: typeof body.reporter === "string" ? body.reporter : undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to create concern",
    });
  }
});

sheqRouter.get("/concerns/:id/download", async (req, res) => {
  const item = await getConcern(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Concern not found" });
    return;
  }
  const html = buildConcernDownloadHtml(item);
  const filename = `${item.id.replace(/[^\w.-]+/g, "_")}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(html);
});

sheqRouter.get("/concerns/:id", async (req, res) => {
  const item = await getConcern(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Concern not found" });
    return;
  }
  res.json(item);
});

sheqRouter.put("/concerns/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await updateConcern(req.params.id, {
      templateId: typeof body.templateId === "string" ? body.templateId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      anonymous:
        typeof body.anonymous === "boolean" ? body.anonymous : undefined,
      reporter: typeof body.reporter === "string" ? body.reporter : undefined,
    });
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update concern";
    res.status(message === "Concern not found" ? 404 : 400).json({ error: message });
  }
});

sheqRouter.delete("/concerns/:id", async (req, res) => {
  const ok = await deleteConcern(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Concern not found" });
    return;
  }
  res.status(204).send();
});

sheqRouter.get("/sheq-forms", async (_req, res) => {
  res.json({ items: await listSheqForms() });
});

sheqRouter.post("/sheq-forms", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  try {
    const body = req.body ?? {};
    const created = await createSheqForm({
      templateId: String(body.templateId ?? ""),
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      status:
        body.status === "Draft" || body.status === "Submitted" || body.status === "Closed"
          ? body.status
          : undefined,
      createdById: actor.id,
      createdByName: actor.name,
      company: actor.company,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to create SHEQ form",
    });
  }
});

sheqRouter.get("/sheq-forms/:id/download", async (req, res) => {
  const item = await getSheqForm(req.params.id);
  if (!item) {
    res.status(404).json({ error: "SHEQ form not found" });
    return;
  }
  const html = buildSheqFormDownloadHtml(item);
  const filename = `${item.id.replace(/[^\w.-]+/g, "_")}.html`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(html);
});

sheqRouter.get("/sheq-forms/:id", async (req, res) => {
  const item = await getSheqForm(req.params.id);
  if (!item) {
    res.status(404).json({ error: "SHEQ form not found" });
    return;
  }
  res.json(item);
});

sheqRouter.put("/sheq-forms/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const updated = await updateSheqForm(req.params.id, {
      templateId: typeof body.templateId === "string" ? body.templateId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      formData:
        body.formData && typeof body.formData === "object"
          ? (body.formData as Record<string, string>)
          : undefined,
      status:
        body.status === "Draft" || body.status === "Submitted" || body.status === "Closed"
          ? body.status
          : undefined,
    });
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update SHEQ form";
    res.status(message === "SHEQ form not found" ? 404 : 400).json({ error: message });
  }
});

sheqRouter.delete("/sheq-forms/:id", async (req, res) => {
  const ok = await deleteSheqForm(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "SHEQ form not found" });
    return;
  }
  res.status(204).send();
});

sheqRouter.get("/kpis", (_req, res) => {
  res.json({
    groups: kpiGroups,
    months: kpiMonths,
  });
});

sheqRouter.get("/dashboard", async (req, res) => {
  const actor = await getSessionUser(bearerToken(req));
  const sites = await listSites();
  const ncItems = await listNonConformances(actor);
  const userNotifications = actor
    ? await listNotificationsForUser(actor.id)
    : [];
  res.json({
    overview: {
      ...overview,
      openNonConformances: ncItems.filter(
        (n) => n.status !== "Closed" && n.status !== "Rejected",
      ).length,
      closedNonConformances: ncItems.filter((n) => n.status === "Closed").length,
    },
    monthlyAudits,
    disciplineTrend,
    ncTrend,
    sitePerformance: sites.map((s) => ({
      name: s.name.split(" ")[0],
      score: s.compliance,
    })),
    kpiGroups,
    activities,
    notifications: userNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      detail: n.message,
      when: n.createdAt,
      unread: !n.isRead,
      type: n.type,
      referenceType: n.referenceType,
      referenceId: n.referenceId,
    })),
    upcomingAudits,
  });
});

sheqRouter.get("/form-field-types", (_req, res) => {
  res.json(formFieldTypes);
});

sheqRouter.get("/notifications", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const items = await listNotificationsForUser(actor.id);
  res.json({
    items,
    unread: await unreadCountForUser(actor.id),
  });
});

sheqRouter.post("/notifications/:id/read", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const item = await markNotificationRead(actor.id, req.params.id);
  if (!item) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(item);
});

sheqRouter.post("/notifications/read-all", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;
  const count = await markAllNotificationsRead(actor.id);
  res.json({ updated: count });
});

/** Lightweight realtime stream for notification push to connected clients. */
sheqRouter.get("/notifications/stream", async (req, res) => {
  const actor = await requireAnyUser(req, res);
  if (!actor) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: actor.id })}\n\n`);

  const onNotify = (item: { userId: string }) => {
    if (item.userId !== actor.id) return;
    res.write(`event: notification\ndata: ${JSON.stringify(item)}\n\n`);
  };
  notificationBus.on("notification", onNotify);
  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    notificationBus.off("notification", onNotify);
  });
});

sheqRouter.get("/activities", (_req, res) => {
  res.json(activities);
});

sheqRouter.get("/kpi-stats/:discipline/years", async (req, res) => {
  try {
    res.json({ years: await listKpiStatYears(req.params.discipline) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid discipline" });
  }
});

sheqRouter.get("/kpi-stats/:discipline", async (req, res) => {
  try {
    const year = Number(req.query.year ?? new Date().getFullYear());
    res.json(await getKpiStatYear(req.params.discipline, year));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
  }
});

sheqRouter.put("/kpi-stats/:discipline", async (req, res) => {
  try {
    const year = Number(req.body?.year ?? req.query.year ?? new Date().getFullYear());
    const saved = await saveKpiStatYear(req.params.discipline, year, req.body?.rows);
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save KPI stats" });
  }
});

// Backward-compatible OHS routes
sheqRouter.get("/ohs/years", async (_req, res) => {
  res.json({ years: await listKpiStatYears("health-safety") });
});

sheqRouter.get("/ohs", async (req, res) => {
  try {
    const year = Number(req.query.year ?? new Date().getFullYear());
    res.json(await getKpiStatYear("health-safety", year));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid year" });
  }
});

sheqRouter.put("/ohs", async (req, res) => {
  try {
    const year = Number(req.body?.year ?? req.query.year ?? new Date().getFullYear());
    const saved = await saveKpiStatYear("health-safety", year, req.body?.rows);
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to save OHS data" });
  }
});
