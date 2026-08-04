import crypto from "node:crypto";
import type { User } from "./sheq.js";
import {
  authenticateUser,
  getUserById,
  signupUser,
  type SignupUserInput,
} from "./users-store.js";
import { query } from "../db/pool.js";

const SESSION_DAYS = 14;

function createSession(userId: string) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return {
    token: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function loginWithPassword(email: string, password: string): Promise<{
  token: string;
  user: User;
  expiresAt: string;
}> {
  const user = await authenticateUser(email, password);
  const session = createSession(user.id);
  await query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
  await query(
    `INSERT INTO sessions(token, user_id, created_at, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [session.token, session.userId, session.createdAt, session.expiresAt],
  );
  return { token: session.token, user, expiresAt: session.expiresAt };
}

export async function signupWithPassword(input: SignupUserInput): Promise<{
  token: string;
  user: User;
  expiresAt: string;
}> {
  const user = await signupUser(input);
  const session = createSession(user.id);
  await query(
    `INSERT INTO sessions(token, user_id, created_at, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [session.token, session.userId, session.createdAt, session.expiresAt],
  );
  return { token: session.token, user, expiresAt: session.expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const result = await query<{
    token: string;
    user_id: string;
    expires_at: Date;
  }>("SELECT token, user_id, expires_at FROM sessions WHERE token = $1", [token]);
  const session = result.rows[0];
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }
  return (await getUserById(session.user_id)) ?? null;
}

export async function logoutSession(token: string | undefined) {
  if (!token) return;
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}
