import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";
import { getProducts } from "@/lib/squarespace";
import { getPlanCredits, getPlanName } from "@/lib/plans";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || undefined;

  const { products, nextCursor, hasNextPage } = await getProducts(
    store.accessToken,
    cursor
  );

  // Load local alt text records for this page
  const productIds = products.map((p) => p.id);
  const localAltTexts = await db.altText.findMany({
    where: { storeId: store.id, productId: { in: productIds } },
  });

  const altTextsByImageId = localAltTexts.reduce(
    (acc, curr) => {
      acc[curr.imageId] = curr;
      return acc;
    },
    {} as Record<string, (typeof localAltTexts)[0]>
  );

  const enrichedProducts = products.map((p) => ({
    ...p,
    images: p.images.map((img) => {
      const local = altTextsByImageId[img.id];
      return {
        ...img,
        localGeneratedAltText: local?.finalAltText ?? null,
        localStatus: local?.status ?? (img.altText ? "APPLIED" : "MISSING"),
      };
    }),
  }));

  // Stats
  const totalGenerated = await db.altText.count({ where: { storeId: store.id } });
  const totalApplied = await db.altText.count({ where: { storeId: store.id, status: "APPLIED" } });
  const totalImages = enrichedProducts.reduce((s, p) => s + p.images.length, 0);
  const imagesWithAlt = enrichedProducts.reduce(
    (s, p) => s + p.images.filter((img) => img.altText).length,
    0
  );
  const coveragePercent =
    totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100;

  return NextResponse.json({
    store: {
      plan: store.plan,
      planName: getPlanName(store.plan),
      creditsRemaining: store.creditsRemaining,
      creditsUsed: store.creditsUsed,
      totalCredits: getPlanCredits(store.plan),
      altTextStyle: store.altTextStyle,
      defaultLanguage: store.defaultLanguage,
    },
    products: enrichedProducts,
    pagination: { nextCursor, hasNextPage },
    stats: { totalGenerated, totalApplied, totalImages, imagesWithAlt, coveragePercent },
  });
}
