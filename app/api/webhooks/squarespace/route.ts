import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getProduct, updateImageAltText } from "@/lib/squarespace";
import { generateAltText, type ProductContext } from "@/lib/openai";

// Squarespace sends webhooks with HMAC-SHA256 signature in X-Squarespace-Signature header
// Verification is omitted here for brevity — add in production using crypto.timingSafeEqual

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic as string; // e.g. "commerce.products.create"
    const siteId = body.websiteId as string;

    if (!topic?.startsWith("commerce.products")) return NextResponse.json({ ok: true });

    const store = await db.store.findUnique({ where: { siteId } });
    if (!store?.autoProcess || store.creditsRemaining <= 0) {
      return NextResponse.json({ ok: true });
    }

    const productId = body.data?.id as string;
    if (!productId) return NextResponse.json({ ok: true });

    const { title, description, tags, images } = await getProduct(
      store.accessToken,
      productId
    );

    const imagesNeedingAlt = images
      .filter((img) => !img.altText || img.altText.trim() === "")
      .slice(0, store.creditsRemaining);

    if (!imagesNeedingAlt.length) return NextResponse.json({ ok: true });

    const context: ProductContext = {
      name: title,
      description: description || undefined,
      tags: tags?.length ? tags : undefined,
    };

    for (const image of imagesNeedingAlt) {
      try {
        const result = await generateAltText(
          image.url,
          context,
          store.altTextStyle as any,
          store.defaultLanguage
        );
        await updateImageAltText(store.accessToken, productId, image.id, result.altText);

        await db.altText.upsert({
          where: { storeId_productId_imageId: { storeId: store.id, productId, imageId: image.id } },
          create: {
            storeId: store.id, productId, productName: title,
            imageId: image.id, imageUrl: image.url,
            generatedAltText: result.altText, finalAltText: result.altText,
            status: "APPLIED", appliedAt: new Date(),
          },
          update: {
            generatedAltText: result.altText, finalAltText: result.altText,
            status: "APPLIED", appliedAt: new Date(),
          },
        });

        await db.store.update({
          where: { id: store.id },
          data: { creditsUsed: { increment: 1 }, creditsRemaining: { decrement: 1 } },
        });

        await db.usageRecord.create({
          data: { storeId: store.id, action: "AUTO_PROCESS", productId, imageId: image.id },
        });
      } catch (err) {
        console.error(`Auto-process failed for image ${image.id}:`, err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Squarespace webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
