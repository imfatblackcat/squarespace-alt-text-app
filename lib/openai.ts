import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface ProductContext {
  name: string;
  description?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
}

export interface AltTextResult {
  altText: string;
  tokensUsed: number;
}

export type AltTextStyle = "concise" | "balanced" | "detailed";

// ─── Style-specific prompt configurations ─────────────────────────────────────

interface StyleConfig {
  systemPrompt: string;
  userInstruction: string;
  maxTokens: number;
  temperature: number;
  maxChars: number;
}

function getStyleConfig(style: AltTextStyle, language: string): StyleConfig {
  const langInstruction =
    language === "en"
      ? "Write in English"
      : `Write in ${getLanguageName(language)}`;

  switch (style) {
    case "concise":
      return {
        systemPrompt: `You are an expert at writing concise, SEO-optimized alt text for e-commerce product images.

Rules:
- Write ONE short phrase or sentence, between 50 and 100 characters long
- Always end with a complete thought — never cut off mid-sentence
- Focus on: product type, brand, primary color, and key visual feature
- Be direct and keyword-rich — prioritize SEO value
- Do NOT start with "Image of", "Picture of", "Photo of"
- Do NOT mention pricing or promotional text
- ${langInstruction}

Example (62 chars): "Navy blue merino wool crew neck sweater with cable-knit pattern"

Use the product context provided to enrich your description with accurate product names and details.`,
        userInstruction:
          "Write a short, keyword-rich alt text phrase between 50-100 characters. Always end with a complete thought. Output only the alt text, nothing else.",
        maxTokens: 80,
        temperature: 0.5,
        maxChars: 150,
      };

    case "balanced":
      return {
        systemPrompt: `You are an expert at writing rich, descriptive alt text for e-commerce product images.

Your goal is to paint a vivid picture of what is visually shown in the image so that someone who cannot see the image fully understands it.

Rules:
- Write 1-2 full, natural sentences, between 120 and 200 characters long
- Always end with a complete sentence — never cut off mid-sentence
- Describe specific visual elements: colors, materials, patterns, composition
- Include product details like brand name, color, material, and type when visible or provided in context
- Write for ACCESSIBILITY first, SEO second
- Do NOT start with "Image of", "Picture of", "Photo of", or "A photo showing"
- Do NOT mention pricing, discounts, or promotional text
- Do NOT use generic filler phrases like "high quality" or "beautiful design"
- ${langInstruction}

Example (130 chars):
"A folded navy blue wool sweater on a white surface. The ribbed collar and cable-knit pattern across the chest are clearly visible."

Use the product context provided to enrich your description with accurate product names and details.`,
        userInstruction:
          "Describe what you see in 1-2 natural sentences, between 120-200 characters. Always end with a complete sentence. Output only the alt text, nothing else.",
        maxTokens: 150,
        temperature: 0.6,
        maxChars: 300,
      };

    case "detailed":
      return {
        systemPrompt: `You are an expert at writing comprehensive, highly descriptive alt text for e-commerce product images.

Your goal is to provide a thorough visual description so that someone using a screen reader experiences the image as fully as possible.

Rules:
- Write 2-3 full, detailed sentences, between 200 and 350 characters long
- Always end with a complete sentence — never cut off mid-sentence
- Describe key visible elements: shapes, patterns, colors, textures, composition, perspective, background
- Mention spatial relationships (e.g., "centered on", "displayed against", "shown from a side angle")
- Include product details like brand, color, material, type, and visible features
- Write for ACCESSIBILITY as primary goal
- Do NOT start with "Image of", "Picture of", "Photo of", or "A photo showing"
- Do NOT mention pricing, discounts, or promotional text
- Do NOT use generic filler phrases like "high quality" or "beautiful design"
- ${langInstruction}

Example (255 chars):
"Top and bottom view of a snowboard displayed side by side against a dark background. The top view features a hexagonal logo that radiates outwards. The bottom reveals an angular grid pattern in deep purple and violet tones."

Use the product context provided to enrich your description with accurate product names and details.`,
        userInstruction:
          "Describe what you see in 2-3 detailed sentences, between 200-350 characters. Always end with a complete sentence. Output only the alt text, nothing else.",
        maxTokens: 250,
        temperature: 0.6,
        maxChars: 500,
      };
  }
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    pl: "Polish",
    ja: "Japanese",
  };
  return languages[code] || "English";
}

// ─── Generation functions ──────────────────────────────────────────────────────

export async function generateAltText(
  imageUrl: string,
  context: ProductContext,
  style: AltTextStyle = "balanced",
  language: string = "en"
): Promise<AltTextResult> {
  const contextPrompt = buildContextPrompt(context);
  const openai = getOpenAIClient();
  const config = getStyleConfig(style, language);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: config.systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Generate alt text for this product image.\n\nProduct Context:\n${contextPrompt}\n\n${config.userInstruction}`,
          },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "auto" },
          },
        ],
      },
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  });

  const altText = response.choices[0]?.message?.content?.trim() || "";
  const tokensUsed = response.usage?.total_tokens || 0;

  return { altText: cleanAltText(altText, config.maxChars), tokensUsed };
}

export async function generateAltTextBatch(
  images: Array<{ imageUrl: string; imageId: string; context: ProductContext }>,
  style: AltTextStyle = "balanced",
  language: string = "en"
): Promise<
  Array<{ imageId: string; altText: string; tokensUsed: number; error?: string }>
> {
  const results = await Promise.allSettled(
    images.map(async ({ imageUrl, imageId, context }) => {
      try {
        const result = await generateAltText(imageUrl, context, style, language);
        return { imageId, ...result };
      } catch (error) {
        return {
          imageId,
          altText: "",
          tokensUsed: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      imageId: images[index].imageId,
      altText: "",
      tokensUsed: 0,
      error: result.reason?.message || "Failed to generate alt text",
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContextPrompt(context: ProductContext): string {
  const parts: string[] = [`Product Name: ${context.name}`];
  if (context.vendor) parts.push(`Brand/Vendor: ${context.vendor}`);
  if (context.productType) parts.push(`Product Type: ${context.productType}`);
  if (context.tags?.length) parts.push(`Tags: ${context.tags.join(", ")}`);
  if (context.description) {
    const clean = stripHtml(context.description);
    parts.push(
      `Description: ${clean.length <= 200 ? clean : clean.substring(0, 200) + "..."}`
    );
  }
  return parts.join("\n");
}

function cleanAltText(altText: string, maxChars: number = 300): string {
  let cleaned = altText.trim();

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  const badPrefixes = [
    "image of ",
    "picture of ",
    "photo of ",
    "photograph of ",
    "alt text: ",
    "alt: ",
  ];
  for (const prefix of badPrefixes) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
      break;
    }
  }

  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  if (cleaned.length > maxChars) {
    const sentenceEnds: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      if (
        cleaned[i] === "." ||
        cleaned[i] === "!" ||
        cleaned[i] === "?"
      ) {
        sentenceEnds.push(i + 1);
      }
    }
    const validEnds = sentenceEnds.filter((pos) => pos <= maxChars);
    if (validEnds.length > 0) {
      cleaned = cleaned
        .substring(0, validEnds[validEnds.length - 1])
        .trim();
    } else {
      cleaned = cleaned.substring(0, maxChars).trim();
    }
  }

  if (cleaned.endsWith(".")) cleaned = cleaned.slice(0, -1);

  return cleaned;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
