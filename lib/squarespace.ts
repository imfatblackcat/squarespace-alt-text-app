// Squarespace Commerce API v1
// Docs: https://developers.squarespace.com/commerce-apis/products

const SQUARESPACE_API_BASE = "https://api.squarespace.com/1.0";

export interface SquarespaceImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface SquarespaceProduct {
  id: string;
  title: string;         // maps to variantAttributes/name
  description: string;
  tags: string[];
  images: SquarespaceImage[];
}

export interface ProductsPage {
  products: SquarespaceProduct[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// ─── Fetch paginated products ─────────────────────────────────────────────────

export async function getProducts(
  accessToken: string,
  cursor?: string | null,
  pageSize = 10
): Promise<ProductsPage> {
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(
    `${SQUARESPACE_API_BASE}/commerce/products?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SpectoAI-AltText/1.0",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Squarespace API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  const products: SquarespaceProduct[] = (data.products ?? []).map(
    mapProduct
  );

  return {
    products,
    nextCursor: data.pagination?.nextPageCursor ?? null,
    hasNextPage: !!data.pagination?.hasNextPage,
  };
}

// ─── Fetch single product ─────────────────────────────────────────────────────

export async function getProduct(
  accessToken: string,
  productId: string
): Promise<SquarespaceProduct> {
  const res = await fetch(
    `${SQUARESPACE_API_BASE}/commerce/products/${productId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SpectoAI-AltText/1.0",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Squarespace API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return mapProduct(data);
}

// ─── Update image alt text ────────────────────────────────────────────────────
// Squarespace doesn't have a dedicated image-alt-text endpoint.
// We update the product's image store page (main image alt) via PATCH on the
// product, sending the images array with updated altText values.

export async function updateImageAltText(
  accessToken: string,
  productId: string,
  imageId: string,
  altText: string
): Promise<void> {
  // First fetch the current product to get all images
  const product = await getProduct(accessToken, productId);

  // Build updated images array with our target image patched
  const updatedImages = product.images.map((img) =>
    img.id === imageId ? { ...img, altText } : img
  );

  const res = await fetch(
    `${SQUARESPACE_API_BASE}/commerce/products/${productId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "SpectoAI-AltText/1.0",
      },
      body: JSON.stringify({
        images: updatedImages.map((img) => ({
          id: img.id,
          altText: img.altText ?? "",
        })),
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to update alt text for image ${imageId}: ${res.status} ${body}`
    );
  }
}

// ─── OAuth token exchange ─────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}> {
  const res = await fetch("https://login.squarespace.com/api/1/login/oauth/provider/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      client_id: process.env.SQUARESPACE_CLIENT_ID!,
      client_secret: process.env.SQUARESPACE_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
  };
}

// ─── Fetch website info (siteId + name) ──────────────────────────────────────

export async function getWebsiteInfo(accessToken: string): Promise<{
  siteId: string;
  siteName: string;
}> {
  const res = await fetch(`${SQUARESPACE_API_BASE}/authorization/website`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "SpectoAI-AltText/1.0",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch website info: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    siteId: data.id,
    siteName: data.baseUrl ?? data.id,
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapProduct(raw: any): SquarespaceProduct {
  const images: SquarespaceImage[] = (raw.images ?? []).map((img: any) => ({
    id: img.id,
    url: img.originalSize?.url ?? img.url ?? "",
    altText: img.altText || null,
    width: img.originalSize?.width ?? 0,
    height: img.originalSize?.height ?? 0,
  }));

  return {
    id: raw.id,
    title: raw.name ?? raw.title ?? "Untitled",
    description: raw.description ?? "",
    tags: raw.tags ?? [],
    images,
  };
}
