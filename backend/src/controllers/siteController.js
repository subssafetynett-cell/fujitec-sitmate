const prisma = require("../prismaClient");
const { isSafetynettCompanyName } = require("../utils/company");
const {
    buildSiteListWhere,
    mergeSiteSearchWhere,
    resolveSiteClientId,
    userCanAccessSite,
} = require("../utils/siteAccess");

const SITE_CREATE_ROLES = ["superadmin", "company_admin"];

const MANAGER_USER_SELECT = {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
};

/** List / mutation response — no emails, no unused createdAt / primary manager join. */
const SITE_LIST_SELECT = {
    id: true,
    name: true,
    address: true,
    isActive: true,
    managerId: true,
    siteManagers: {
        select: {
            user: { select: MANAGER_USER_SELECT },
        },
    },
};

function assertCanCreateSite(req) {
    if (isSafetynettCompanyName(req.user?.companyname || req.user?.company)) {
        return null;
    }
    if (SITE_CREATE_ROLES.includes(req.user?.role)) {
        return null;
    }
    return {
        status: 403,
        error: "Only Super Admin or Company Admin can create sites.",
    };
}

function companyUserWhere(req) {
    const actingId = req.actingClient?.id;
    if (actingId) return { clientId: actingId };

    const user = req.scopedUser || req.user;
    const { role, clientId } = user;
    if (role === "company_admin") {
        if (!clientId) return null;
        return { clientId };
    }
    if (clientId) return { clientId };
    return {};
}

function normalizeManagerIds(body = {}) {
    if (Array.isArray(body.managerIds)) {
        return [...new Set(body.managerIds.filter(Boolean))];
    }
    if (body.managerId) {
        return [body.managerId];
    }
    return [];
}

async function assertManagersInCompany(req, managerIds) {
    if (!managerIds.length) return true;
    const companyWhere = companyUserWhere(req);
    if (companyWhere === null) return false;

    const count = await prisma.user.count({
        where: {
            id: { in: managerIds },
            active: true,
            accessMode: "standard",
            ...companyWhere,
        },
    });
    return count === managerIds.length;
}

async function resolveClientIdFromManagers(req, managerIds) {
    if (!managerIds.length) {
        return resolveSiteClientId(req, null);
    }
    const mgr = await prisma.user.findUnique({
        where: { id: managerIds[0] },
        select: { clientId: true },
    });
    return resolveSiteClientId(req, mgr?.clientId || null);
}

function formatSiteResponse(site) {
    if (!site) return site;
    const managers = (site.siteManagers || [])
        .map((row) => row.user)
        .filter(Boolean);
    const { siteManagers, ...rest } = site;
    return {
        ...rest,
        managers,
        managerIds: managers.map((m) => m.id),
    };
}

function parsePagination(query = {}) {
    const hasPage = query.page !== undefined && query.page !== "";
    const hasLimit = query.limit !== undefined && query.limit !== "";
    if (!hasPage && !hasLimit) return null;

    const page = Math.max(0, parseInt(query.page, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    return { page, limit, skip: page * limit };
}

// Create a new site
exports.createSite = async (req, res) => {
    try {
        const denied = assertCanCreateSite(req);
        if (denied) {
            return res.status(denied.status).json({ error: denied.error });
        }

        const { name, address } = req.body;
        const managerIds = normalizeManagerIds(req.body);

        if (!name || !address) {
            return res.status(400).json({ error: "Name and Address are required." });
        }

        const [managersOk, clientId] = await Promise.all([
            assertManagersInCompany(req, managerIds),
            resolveClientIdFromManagers(req, managerIds),
        ]);

        if (!managersOk) {
            return res.status(400).json({
                error: "One or more selected site managers are not valid for your company.",
            });
        }

        const newSite = await prisma.site.create({
            data: {
                name,
                address,
                managerId: managerIds[0] || null,
                clientId,
                siteManagers: managerIds.length
                    ? { create: managerIds.map((userId) => ({ userId })) }
                    : undefined,
            },
            select: SITE_LIST_SELECT,
        });

        res.status(201).json(formatSiteResponse(newSite));
    } catch (error) {
        console.error("Error creating site:", error);
        res.status(500).json({ error: "Failed to create site." });
    }
};

// Get sites (optional search + optional pagination)
exports.getAllSites = async (req, res) => {
    try {
        const { search } = req.query;
        const actingClientId = req.actingClient?.id || null;
        const accessWhere = buildSiteListWhere(req.scopedUser || req.user, actingClientId);
        let where = mergeSiteSearchWhere(accessWhere, search);

        if (String(req.query.activeOnly || "").toLowerCase() === "true") {
            where = Object.keys(where).length
                ? { AND: [where, { isActive: true }] }
                : { isActive: true };
        }

        const pagination = parsePagination(req.query);
        const orderBy = { createdAt: "desc" };

        if (pagination) {
            const [total, sites] = await Promise.all([
                prisma.site.count({ where }),
                prisma.site.findMany({
                    where,
                    select: SITE_LIST_SELECT,
                    orderBy,
                    skip: pagination.skip,
                    take: pagination.limit,
                }),
            ]);

            return res.json({
                success: true,
                sites: sites.map(formatSiteResponse),
                total,
                page: pagination.page,
                limit: pagination.limit,
            });
        }

        // Backward-compatible array for Sitepack / Monitoring pickers.
        const sites = await prisma.site.findMany({
            where,
            select: SITE_LIST_SELECT,
            orderBy,
        });

        res.json(sites.map(formatSiteResponse));
    } catch (error) {
        console.error("Error fetching sites:", error);
        res.status(500).json({ error: "Failed to fetch sites." });
    }
};

// Update site (including Activate/Deactivate)
exports.updateSite = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, isActive } = req.body;
        const hasManagerUpdate =
            req.body.managerIds !== undefined || req.body.managerId !== undefined;
        const managerIds = hasManagerUpdate ? normalizeManagerIds(req.body) : null;

        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, id, actingClientId))) {
            return res.status(403).json({ error: "You do not have access to this site." });
        }

        // Fast path: status toggle only
        if (
            isActive !== undefined &&
            name === undefined &&
            address === undefined &&
            managerIds === null
        ) {
            const updated = await prisma.site.update({
                where: { id },
                data: { isActive },
                select: SITE_LIST_SELECT,
            });
            return res.json(formatSiteResponse(updated));
        }

        if (managerIds && !(await assertManagersInCompany(req, managerIds))) {
            return res.status(400).json({
                error: "One or more selected site managers are not valid for your company.",
            });
        }

        const data = {};
        if (name !== undefined) data.name = name;
        if (address !== undefined) data.address = address;
        if (isActive !== undefined) data.isActive = isActive;

        if (managerIds !== null) {
            data.managerId = managerIds[0] || null;
            data.clientId = await resolveClientIdFromManagers(req, managerIds);
        }

        const updatedSite = await prisma.$transaction(async (tx) => {
            await tx.site.update({ where: { id }, data });

            if (managerIds !== null) {
                await tx.siteManager.deleteMany({ where: { siteId: id } });
                if (managerIds.length) {
                    await tx.siteManager.createMany({
                        data: managerIds.map((userId) => ({ siteId: id, userId })),
                        skipDuplicates: true,
                    });
                }
            }

            return tx.site.findUnique({
                where: { id },
                select: SITE_LIST_SELECT,
            });
        });

        res.json(formatSiteResponse(updatedSite));
    } catch (error) {
        console.error("Error updating site:", error);
        res.status(500).json({ error: "Failed to update site." });
    }
};

// Delete site — clear dependents in indexed batches, then remove the site.
exports.deleteSite = async (req, res) => {
    try {
        const { id } = req.params;

        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, id, actingClientId))) {
            return res.status(403).json({ error: "You do not have access to this site." });
        }

        await prisma.$transaction(async (tx) => {
            await tx.formResponse.updateMany({
                where: { siteId: id },
                data: { siteId: null, subfolderId: null },
            });
            await tx.siteDocument.deleteMany({ where: { siteId: id } });
            await tx.siteSubfolder.deleteMany({ where: { siteId: id } });
            await tx.siteManager.deleteMany({ where: { siteId: id } });
            await tx.site.delete({ where: { id } });
        });

        res.json({ message: "Site deleted successfully." });
    } catch (error) {
        console.error("Error deleting site:", error);
        res.status(500).json({ error: "Failed to delete site." });
    }
};

exports.getSiteSubfolders = async (req, res) => {
    try {
        const { siteId } = req.params;
        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, actingClientId))) {
            return res.status(403).json({ success: false, message: "You do not have access to this site." });
        }

        const scope = String(req.query.scope || "").trim();
        const monitoringSection = String(req.query.monitoringSection || "").trim();
        const where = { siteId };

        if (scope === "sitepack") {
            where.monitoringSection = null;
        } else if (monitoringSection) {
            where.monitoringSection = monitoringSection;
        }

        const subfolders = await prisma.siteSubfolder.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({ success: true, subfolders });
    } catch (error) {
        console.error("Error fetching site subfolders:", error);
        res.status(500).json({ success: false, message: "Failed to fetch subfolders." });
    }
};

exports.createSiteSubfolder = async (req, res) => {
    try {
        const { siteId } = req.params;
        const name = String(req.body?.name || "").trim();
        const monitoringSectionRaw = req.body?.monitoringSection;
        const monitoringSection =
            monitoringSectionRaw != null && String(monitoringSectionRaw).trim() !== ""
                ? String(monitoringSectionRaw).trim()
                : null;

        if (!name) {
            return res.status(400).json({ success: false, message: "Subfolder name is required." });
        }

        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, actingClientId))) {
            return res.status(403).json({ success: false, message: "You do not have access to this site." });
        }

        const subfolder = await prisma.siteSubfolder.create({
            data: { name, siteId, monitoringSection },
        });

        res.status(201).json({ success: true, subfolder });
    } catch (error) {
        console.error("Error creating site subfolder:", error);
        res.status(500).json({ success: false, message: "Failed to create subfolder." });
    }
};

exports.deleteSiteSubfolder = async (req, res) => {
    try {
        const { siteId, subfolderId } = req.params;
        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, actingClientId))) {
            return res.status(403).json({ success: false, message: "You do not have access to this site." });
        }

        const existing = await prisma.siteSubfolder.findFirst({
            where: { id: subfolderId, siteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Subfolder not found." });
        }

        const orphanedResponses = await prisma.formResponse.findMany({
            where: { siteId, subfolderId },
            select: { id: true, answers: true },
        });

        await prisma.$transaction(async (tx) => {
            for (const row of orphanedResponses) {
                const answers =
                    row.answers && typeof row.answers === "object"
                        ? { ...row.answers }
                        : {};
                delete answers.subfolderId;
                await tx.formResponse.update({
                    where: { id: row.id },
                    data: { subfolderId: null, answers },
                });
            }

            await tx.siteSubfolder.delete({ where: { id: subfolderId } });
        });

        res.json({ success: true, message: "Subfolder deleted." });
    } catch (error) {
        console.error("Error deleting site subfolder:", error);
        res.status(500).json({ success: false, message: "Failed to delete subfolder." });
    }
};

exports.updateSiteSubfolder = async (req, res) => {
    try {
        const { siteId, subfolderId } = req.params;
        const name = String(req.body?.name || "").trim();

        if (!name) {
            return res.status(400).json({ success: false, message: "Subfolder name is required." });
        }

        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, siteId, actingClientId))) {
            return res.status(403).json({ success: false, message: "You do not have access to this site." });
        }

        const existing = await prisma.siteSubfolder.findFirst({
            where: { id: subfolderId, siteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Subfolder not found." });
        }

        const subfolder = await prisma.siteSubfolder.update({
            where: { id: subfolderId },
            data: { name },
        });

        res.json({ success: true, subfolder });
    } catch (error) {
        console.error("Error updating site subfolder:", error);
        res.status(500).json({ success: false, message: "Failed to update subfolder." });
    }
};

// All active users in the requester's company (for site manager assignment)
exports.getSiteManagers = async (req, res) => {
    try {
        const companyWhere = companyUserWhere(req);
        if (companyWhere === null) {
            return res.status(400).json({ error: "Company context required." });
        }

        const managers = await prisma.user.findMany({
            where: {
                active: true,
                accessMode: "standard",
                ...companyWhere,
            },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                email: true,
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });
        res.json(managers);
    } catch (error) {
        console.error("Error fetching site managers:", error);
        res.status(500).json({ error: "Failed to fetch managers." });
    }
};
