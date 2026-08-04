import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readBlob, writeBlob } from "../db/blob-store.js";

export type NotificationType =
  | "NC_CREATED"
  | "NC_APPROVED"
  | "NC_REJECTED"
  | "NC_ASSIGNED"
  | "NC_RESPONSE_SUBMITTED"
  | "NC_REOPENED"
  | "NC_CLOSED"
  | "GENERAL";

export type AppNotification = {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceType: "nonconformance" | "general";
  referenceId: string;
  isRead: boolean;
  createdAt: string;
};

type Store = {
  version: 1;
  notifications: AppNotification[];
};

const BLOB_KEY = "notifications";

/** In-process bus for SSE / realtime clients. */
export const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(100);

async function readStore(): Promise<Store> {
  const raw = await readBlob<Store>(BLOB_KEY, { version: 1, notifications: [] });
  return {
    version: 1,
    notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
  };
}

async function writeStore(store: Store) {
  await writeBlob(BLOB_KEY, store);
}

export async function listNotificationsForUser(
  userId: string,
): Promise<AppNotification[]> {
  const store = await readStore();
  return store.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function unreadCountForUser(userId: string): Promise<number> {
  const items = await listNotificationsForUser(userId);
  return items.filter((n) => !n.isRead).length;
}

export async function createNotification(input: {
  companyId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceType?: AppNotification["referenceType"];
  referenceId?: string;
}): Promise<AppNotification> {
  const store = await readStore();
  const item: AppNotification = {
    id: `NTF-${randomUUID().slice(0, 8)}`,
    companyId: input.companyId,
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type,
    referenceType: input.referenceType ?? "general",
    referenceId: input.referenceId ?? "",
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  store.notifications.unshift(item);
  // Cap growth
  if (store.notifications.length > 2000) {
    store.notifications = store.notifications.slice(0, 2000);
  }
  await writeStore(store);
  notificationBus.emit("notification", item);
  return item;
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<Parameters<typeof createNotification>[0], "userId">,
): Promise<AppNotification[]> {
  const created: AppNotification[] = [];
  for (const userId of userIds) {
    created.push(await createNotification({ ...input, userId }));
  }
  return created;
}

export async function markNotificationRead(
  userId: string,
  id: string,
): Promise<AppNotification | undefined> {
  const store = await readStore();
  const item = store.notifications.find((n) => n.id === id && n.userId === userId);
  if (!item) return undefined;
  item.isRead = true;
  await writeStore(store);
  return item;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const store = await readStore();
  let count = 0;
  for (const n of store.notifications) {
    if (n.userId === userId && !n.isRead) {
      n.isRead = true;
      count += 1;
    }
  }
  if (count) await writeStore(store);
  return count;
}
