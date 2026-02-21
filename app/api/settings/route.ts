import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";

const VALID_STYLES = ["concise", "balanced", "detailed"];
const VALID_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "pl", "ja"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  return NextResponse.json({
    settings: {
      altTextStyle: store.altTextStyle,
      defaultLanguage: store.defaultLanguage,
      autoProcess: store.autoProcess,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const altTextStyle = VALID_STYLES.includes(body.altTextStyle) ? body.altTextStyle : "balanced";
  const defaultLanguage = VALID_LANGUAGES.includes(body.defaultLanguage) ? body.defaultLanguage : "en";
  const autoProcess = Boolean(body.autoProcess);

  await db.store.update({
    where: { id: session.storeId },
    data: { altTextStyle, defaultLanguage, autoProcess },
  });

  return NextResponse.json({ success: true });
}
