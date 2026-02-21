import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie to verify on callback
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.SQUARESPACE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    scope: "website.products,website.products.images,website.orders",
    state,
    response_type: "code",
    access_type: "offline",
  });

  const authUrl = `https://login.squarespace.com/api/1/login/oauth/provider/authorize?${params}`;
  return NextResponse.redirect(authUrl);
}
