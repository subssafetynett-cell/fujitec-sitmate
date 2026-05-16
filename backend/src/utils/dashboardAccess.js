const { isGlobalSiteAccess, buildSiteListWhere } = require("./siteAccess");
const { buildOwnFormResponseWhere } = require("./formResponseAccess");

function canShowDashboardUsers(actor) {
  if (!actor) return false;
  const role = actor.role || "worker";
  return role === "superadmin" || role === "company_admin";
}

function buildDashboardUserCountWhere(actor) {
  if (!canShowDashboardUsers(actor)) return null;
  if (isGlobalSiteAccess(actor)) return {};
  if (actor.role === "company_admin" && actor.clientId) {
    return { clientId: actor.clientId };
  }
  return null;
}

function getDashboardScopeMeta(actor) {
  if (!actor) {
    return {
      label: "Not signed in",
      role: "worker",
      capabilities: {
        showSites: false,
        showUsers: false,
        showCompliance: false,
      },
    };
  }

  const role = actor.role || "worker";
  const global = isGlobalSiteAccess(actor);
  const showUsers = canShowDashboardUsers(actor);

  if (global) {
    return {
      label: "Your submissions",
      role,
      capabilities: {
        showSites: true,
        showUsers,
        showCompliance: true,
      },
    };
  }

  if (role === "company_admin") {
    return {
      label: "Your submissions",
      role,
      capabilities: { showSites: true, showUsers, showCompliance: true },
    };
  }

  if (role === "site_manager") {
    return {
      label: "Your submissions",
      role,
      capabilities: { showSites: true, showUsers: false, showCompliance: true },
    };
  }

  if (role === "supervisor") {
    return {
      label: "Your submissions",
      role,
      capabilities: { showSites: false, showUsers: false, showCompliance: true },
    };
  }

  return {
    label: "Your submissions",
    role,
    capabilities: { showSites: false, showUsers: false, showCompliance: true },
  };
}

/**
 * Dashboard charts/stats: each user sees only their own saved forms and templates.
 */
async function buildDashboardResponseWhere(_prisma, actor) {
  return buildOwnFormResponseWhere(actor?.id);
}

module.exports = {
  buildDashboardResponseWhere,
  buildDashboardUserCountWhere,
  buildSiteListWhere,
  getDashboardScopeMeta,
  canShowDashboardUsers,
};
