import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/data/sheq";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function hrefFor(n: Notification) {
  if (n.referenceType === "nonconformance" && n.referenceId) {
    return `/non-conformances?nc=${encodeURIComponent(n.referenceId)}`;
  }
  return "/non-conformances";
}

export function NotificationBell({
  initialUnread = 0,
}: {
  initialUnread?: number;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(initialUnread);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setItems(
        data.items.map((n) => {
          const item: Notification = {
            title: n.title,
            detail: n.detail || n.message || "",
            when: n.when || n.createdAt || "",
            unread: n.unread ?? !n.isRead,
          };
          if (n.id) item.id = n.id;
          if (n.type) item.type = n.type;
          if (n.referenceType) item.referenceType = n.referenceType;
          if (n.referenceId) item.referenceId = n.referenceId;
          return item;
        }),
      );
      setUnread(data.unread);
    } catch {
      // Keep shell usable if notifications API fails.
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Poll + invalidate after sheq mutations; SSE needs cookie/token bridge later.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const latest = useMemo(() => items.slice(0, 12), [items]);

  async function openItem(n: Notification) {
    if (n.id && n.unread) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)),
        );
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        // continue navigation
      }
    }
    void navigate({ to: hrefFor(n) });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() =>
                void markAllNotificationsRead().then(() => {
                  setUnread(0);
                  setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
                })
              }
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {latest.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          latest.map((n) => (
            <DropdownMenuItem
              key={n.id || `${n.title}-${n.when}`}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-0.5 py-2",
                n.unread && "bg-primary/5",
              )}
              onClick={() => void openItem(n)}
            >
              <span className="text-sm font-medium">{n.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">
                {n.detail}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(n.when)}
                {n.unread ? " · Unread" : ""}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
