const { PrismaClient } = require("@prisma/client");
const { isSafetynettCompanyName } = require("../utils/company");
const {
    buildSiteListWhere,
    mergeSiteSearchWhere,
    resolveSiteClientId,
    userCanAccessSite,
} = require("../utils/siteAccess");
const prisma = new PrismaClient();

const SITE_CREATE_ROLES = ["superadmin", "company_admin"];

const SITE_INCLUDE = {
    manager: {
        select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
        },
    },
    siteManagers: {
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                },
            },
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

async function syncSiteManagers(siteId, managerIds) {
    await prisma.siteManager.deleteMany({ where: { siteId } });
    if (managerIds.length) {
        await prisma.siteManager.createMany({
            data: managerIds.map((userId) => ({ siteId, userId })),
            skipDuplicates: true,
        });
    }
}

function formatSiteResponse(site) {
    const managers = (site.siteManagers || [])
        .map((row) => row.user)
        .filter(Boolean);
    return {
        ...site,
        managers,
        managerIds: managers.map((m) => m.id),
    };
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

        if (!(await assertManagersInCompany(req, managerIds))) {
            return res.status(400).json({
                error: "One or more selected site managers are not valid for your company.",
            });
        }

        const clientId = await resolveClientIdFromManagers(req, managerIds);

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
            include: SITE_INCLUDE,
        });

        res.status(201).json(formatSiteResponse(newSite));
    } catch (error) {
        console.error("Error creating site:", error);
        res.status(500).json({ error: "Failed to create site." });
    }
};

// Get all sites (with optional search)
exports.getAllSites = async (req, res) => {
    try {
        const { search } = req.query;
        const actingClientId = req.actingClient?.id || null;
        const accessWhere = buildSiteListWhere(req.scopedUser || req.user, actingClientId);
        const where = mergeSiteSearchWhere(accessWhere, search);

        const sites = await prisma.site.findMany({
            where,
            include: SITE_INCLUDE,
            orderBy: { createdAt: "desc" },
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
            const site = await tx.site.update({
                where: { id },
                data,
                include: SITE_INCLUDE,
            });

            if (managerIds !== null) {
                await tx.siteManager.deleteMany({ where: { siteId: id } });
                if (managerIds.length) {
                    await tx.siteManager.createMany({
                        data: managerIds.map((userId) => ({ siteId: id, userId })),
                        skipDuplicates: true,
                    });
                }
                return tx.site.findUnique({
                    where: { id },
                    include: SITE_INCLUDE,
                });
            }

            return site;
        });

        res.json(formatSiteResponse(updatedSite));
    } catch (error) {
        console.error("Error updating site:", error);
        res.status(500).json({ error: "Failed to update site." });
    }
};

// Delete site
exports.deleteSite = async (req, res) => {
    try {
        const { id } = req.params;

        const actingClientId = req.actingClient?.id || null;
        if (!(await userCanAccessSite(prisma, req.scopedUser || req.user, id, actingClientId))) {
            return res.status(403).json({ error: "You do not have access to this site." });
        }

        await prisma.site.delete({
            where: { id },
        });
        res.json({ message: "Site deleted successfully." });
    } catch (error) {
        console.error("Error deleting site:", error);
        res.status(500).json({ error: "Failed to delete site." });
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
