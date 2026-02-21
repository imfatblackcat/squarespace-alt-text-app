import { cookies } from "next/headers";
import db from "./db";

export interface AppSession {
  storeId: string;
  userId: string;
  siteId: string;
}

const SESSION_COOKIE = "sai_session";

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    // token is just the storeId — simple, stateless enough for now
    const store = await db.store.findUnique({
      where: { id: token },
      select: { id: true, userId: true, siteId: true },
    });
    if (!store) return null;
    return { storeId: store.id, userId: store.userId, siteId: store.siteId };
  } catch {
    return null;
  }
}

export async function createSession(storeId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, storeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
