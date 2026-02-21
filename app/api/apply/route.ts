import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";
import { updateImageAltText } from "@/lib/squarespace";

// POST /api/apply — bulk apply generated alt texts to Squarespace
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = await request.json();
  const items: Array<{ productId: string; imageId: string }> = body.items;

  if (!items?.length) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  let appliedCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    const localAlt = await db.altText.findUnique({
      where: {
        storeId_productId_imageId: {
          storeId: store.id,
          productId: item.productId,
          imageId: item.imageId,
        },
      },
    });

    if (!localAlt?.finalAltText) continue;

    try {
      await updateImageAltText(
        store.accessToken,
        item.productId,
        item.imageId,
        localAlt.finalAltText
      );
      await db.altText.update({
        where: { id: localAlt.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });
      appliedCount++;
    } catch (err) {
      console.error(`Failed to apply alt text for image ${item.imageId}:`, err);
      errors.push(item.imageId);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Applied ${appliedCount} alt texts to Squarespace.`,
    ...(errors.length ? { errors } : {}),
  });
}

// PATCH /api/apply — edit a single alt text locally (no credit cost)
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = await request.json();
  const { productId, imageId, altText } = body as {
    productId: string;
    imageId: string;
    altText: string;
  };

  await db.altText.updateMany({
    where: { storeId: store.id, productId, imageId },
    data: { finalAltText: altText, generatedAltText: altText, status: "GENERATED" },
  });

  return NextResponse.json({ success: true });
}
