import type { Site, User, UserRole } from "@/data/sheq";

const TOKEN_KEY = "sheq.auth.token";
const USER_KEY = "sheq.auth.user";

export type AuthSession = {
  token: string;
  user: User;
  expiresAt?: string;
};

const ALL_ROLES: UserRole[] = [
  "Super Admin",
  "Company Admin",
  "Supervisor",
  "Site Manager",
];

export function isSuperAdmin(user: User | null | undefined) {
  return user?.role === "Super Admin";
}

export function isCompanyAdmin(user: User | null | undefined) {
  return user?.role === "Company Admin";
}

/** Companies page + company CRUD */
export function canManageCompanies(user: User | null | undefined) {
  return isSuperAdmin(user);
}

/** Users page + invite / edit users */
export function canManageUsers(user: User | null | undefined) {
  return isSuperAdmin(user) || isCompanyAdmin(user);
}

/** Add / create site */
export function canCreateSite(user: User | null | undefined) {
  return isSuperAdmin(user) || isCompanyAdmin(user);
}

/** Roles the actor may assign when inviting/editing a user */
export function assignableRolesFor(
  actor: User | null | undefined,
  currentRole?: UserRole,
): UserRole[] {
  const roles = isSuperAdmin(actor)
    ? [...ALL_ROLES]
    : ALL_ROLES.filter((role) => role !== "Super Admin");

  if (currentRole && !roles.includes(currentRole)) {
    return [currentRole, ...roles];
  }
  return roles;
}

export function sameCompany(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** Super Admin sees everyone; others only see users in their company. */
export function scopeUsersToActor(actor: User | null | undefined, users: User[]): User[] {
  if (!actor || isSuperAdmin(actor)) return users;
  return users.filter((u) => sameCompany(u.company, actor.company));
}

export function isSiteManager(user: User | null | undefined) {
  return user?.role === "Site Manager";
}

function siteManagerNames(site: Site): string[] {
  if (Array.isArray(site.managers) && site.managers.length > 0) {
    return site.managers.map((m) => m.trim()).filter(Boolean);
  }
  if (site.manager?.trim()) {
    return site.manager
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return [];
}

/** Whether the user is listed as a manager on this site (by name or email). */
export function userManagesSite(user: User | null | undefined, site: Site) {
  if (!user) return false;
  if (isSuperAdmin(user) || isCompanyAdmin(user)) return true;
  const identities = [user.name, user.email]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return siteManagerNames(site).some((m) => identities.includes(m.toLowerCase()));
}

/** Super/Company Admin: all sites. Others: only sites they manage. */
export function scopeSitesToActor(actor: User | null | undefined, sites: Site[]): Site[] {
  if (!actor) return [];
  if (isSuperAdmin(actor) || isCompanyAdmin(actor)) return sites;
  return sites.filter((site) => userManagesSite(actor, site));
}

/** Can open / edit site pack documents for a site. */
export function canManageSitePack(user: User | null | undefined, site?: Site | null) {
  if (!user) return false;
  if (isSuperAdmin(user) || isCompanyAdmin(user)) return true;
  if (!site) return isSiteManager(user) || user.role === "Supervisor";
  return userManagesSite(user, site);
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAuthToken(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): User | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  const token = getAuthToken();
  const user = getAuthUser();
  if (!token || !user) return null;
  return { token, user };
}

export function setAuthSession(session: AuthSession) {
  if (!canUseStorage()) return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearAuthSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function initialsFor(user: User | null | undefined) {
  if (!user?.name) return "—";
  return user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
