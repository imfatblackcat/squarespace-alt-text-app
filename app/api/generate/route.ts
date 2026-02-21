import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import db from "@/lib/db";
import { generateAltTextBatch, type ProductContext, type AltTextStyle } from "@/lib/openai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await db.store.findUnique({ where: { id: session.storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = await request.json();
  const items: Array<{
    productId: string;
    productName: string;
    imageId: string;
    imageUrl: string;
    vendor?: string;
    productType?: string;
    tags?: string;
    description?: string;
  }> = body.items;

  if (!items?.length) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  // Atomically reserve credits
  const reserved = await db.store.updateMany({
    where: { id: store.id, creditsRemaining: { gte: items.length } },
    data: { creditsRemaining: { decrement: items.length } },
  });

  if (reserved.count === 0) {
    return NextResponse.json(
      { error: `Not enough credits. Need ${items.length}, have ${store.creditsRemaining}.` },
      { status: 403 }
    );
  }

  let successCount = 0;
  try {
    const batches = items.map((item) => ({
      imageId: item.imageId,
      imageUrl: item.imageUrl,
      context: {
        name: item.productName,
        vendor: item.vendor,
        tags: item.tags ? item.tags.split(",").filter(Boolean) : undefined,
        description: item.description,
      } as ProductContext,
    }));

    const results = await generateAltTextBatch(
      batches,
      (store.altTextStyle || "balanced") as AltTextStyle,
      store.defaultLanguage || "en"
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = items[i];
      if (!result.error && result.altText) {
        successCount++;
        await db.altText.upsert({
          where: {
            storeId_productId_imageId: {
              storeId: store.id,
              productId: item.productId,
              imageId: item.imageId,
            },
          },
          create: {
            storeId: store.id,
            productId: item.productId,
            productName: item.productName,
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            generatedAltText: result.altText,
            finalAltText: result.altText,
            status: "GENERATED",
          },
          update: {
            generatedAltText: result.altText,
            finalAltText: result.altText,
            status: "GENERATED",
          },
        });
      }
    }

    // Refund unused credits
    const unused = items.length - successCount;
    await db.store.update({
      where: { id: store.id },
      data: {
        creditsUsed: { increment: successCount },
        ...(unused > 0 ? { creditsRemaining: { increment: unused } } : {}),
      },
    });

    await db.usageRecord.create({
      data: { storeId: store.id, action: "GENERATE_BULK", creditsUsed: successCount },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully generated ${successCount} alt texts.`,
    });
  } catch (error) {
    // Refund all reserved credits on failure
    await db.store.update({
      where: { id: store.id },
      data: { creditsRemaining: { increment: items.length } },
    }).catch(console.error);

    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
