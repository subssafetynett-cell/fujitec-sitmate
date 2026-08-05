import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Gauge,
  Activity,
  FileStack,
  PencilRuler,
  AlertTriangle,
  ClipboardList,
  Building2,
  BriefcaseBusiness,
  Search,
  Moon,
  Sun,
  Menu,
  Users,
  LogOut,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountSettingsDialog } from "@/components/sheq/account-settings-dialog";
import { NotificationBell } from "@/components/sheq/notification-bell";
import { useSheq } from "@/lib/sheq-context";
import {
  canManageCompanies,
  canManageUsers,
  clearAuthSession,
  getAuthUser,
  initialsFor,
} from "@/lib/auth";
import { logout as apiLogout } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { User } from "@/data/sheq";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, visible: () => true },
  {
    to: "/companies",
    label: "Companies",
    icon: BriefcaseBusiness,
    visible: (user: User | null) => canManageCompanies(user),
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    visible: (user: User | null) => canManageUsers(user),
  },
  { to: "/form-builder", label: "Form Builder", icon: PencilRuler, visible: () => true },
  { to: "/kpis", label: "KPI Management", icon: Gauge, visible: () => true },
  { to: "/sites", label: "Sites & Site Packs", icon: Building2, visible: () => true },
  {
    to: "/performance-monitoring",
    label: "Performance Monitoring",
    icon: Activity,
    visible: () => true,
  },
  { to: "/sheq-forms", label: "SHEQ Forms", icon: ClipboardList, visible: () => true },
  {
    to: "/non-conformances",
    label: "Non-Conformances",
    icon: AlertTriangle,
    visible: () => true,
  },
  { to: "/templates", label: "Templates", icon: FileStack, visible: () => true },
] as const;

function NavList({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: User | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = nav.filter((item) => item.visible(user));
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center justify-start px-1">
      <img
        src="/brand/sitemate-logo.svg"
        alt="Sitemate"
        className="h-14 w-auto max-w-[200px] object-contain object-left"
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { notifications } = useSheq();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(() => getAuthUser());
  const [accountOpen, setAccountOpen] = useState(false);
  const unread = notifications.filter((n) => n.unread).length;
  const initials = initialsFor(user);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setUser(getAuthUser());
  }, []);

  async function handleLogout() {
    try {
      await apiLogout();
    } catch {
      // Clear local session even if the API call fails.
    }
    clearAuthSession();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <Brand />
        <NavList user={user} />
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] bg-sidebar p-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mt-6 flex flex-col gap-6">
                  <Brand />
                  <NavList user={user} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="relative min-w-0 max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search audits, sites, NCs, templates…"
                className="h-10 rounded-xl border-border bg-card pl-9"
                aria-label="Global search"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle dark mode"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <NotificationBell initialUnread={unread} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{user?.name ?? "Signed in"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? ""}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAccountOpen(true)}>
                  <Settings2 />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      </div>

      <AccountSettingsDialog
        user={user}
        open={accountOpen}
        onOpenChange={setAccountOpen}
      />
    </div>
  );
}
