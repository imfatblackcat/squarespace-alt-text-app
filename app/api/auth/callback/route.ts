import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { exchangeCodeForToken, getWebsiteInfo } from "@/lib/squarespace";
import { createSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) {
    return NextResponse.redirect(`${appUrl}/connect?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/connect?error=missing_params`);
  }

  // Verify state to prevent CSRF
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${appUrl}/connect?error=invalid_state`);
  }

  try {
    // Exchange code for access token
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(code);

    // Fetch site info to get siteId
    const { siteId, siteName } = await getWebsiteInfo(accessToken);

    const tokenExpires = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    // Upsert store — create a dummy User record to satisfy the relation
    let user = await db.user.findFirst({ where: { store: { siteId } } });
    if (!user) {
      user = await db.user.create({ data: { name: siteName } });
    }

    const store = await db.store.upsert({
      where: { siteId },
      create: {
        userId: user.id,
        siteId,
        siteName,
        accessToken,
        refreshToken,
        tokenExpires,
        creditsRemaining: 100,
      },
      update: {
        siteName,
        accessToken,
        refreshToken,
        tokenExpires,
      },
    });

    // Set session cookie
    await createSession(store.id);

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/connect?error=${encodeURIComponent("Authentication failed. Please try again.")}`
    );
  }
}
