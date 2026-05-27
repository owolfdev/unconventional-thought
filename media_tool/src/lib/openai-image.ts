export type GenerateVariant = "sticker" | "title";

const DEFAULT_MODEL = "gpt-image-1";

function buildPrompt(userPrompt: string, variant: GenerateVariant): string {
  const subject = userPrompt.trim();
  if (variant === "title") {
    return [
      "Title card artwork for a documentary video overlay.",
      "Transparent background (alpha), no backdrop, no floor shadow.",
      "Large readable typography or symbolic title design; high contrast.",
      "Centered composition suitable for lower-third or center title placement.",
      subject ? `Subject: ${subject}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    "Isolated sticker graphic for video overlay.",
    "Transparent background (alpha), clean cutout edges, no backdrop.",
    "Single bold subject, simple shapes, editorial documentary style.",
    "No border frame; avoid tiny illegible detail.",
    subject ? `Subject: ${subject}` : "",
  ]
      .filter(Boolean)
      .join(" ");
}

export async function generateTransparentPng(
  userPrompt: string,
  variant: GenerateVariant,
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to media_tool/.env.local to generate stickers.",
    );
  }

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  const prompt = buildPrompt(userPrompt, variant);
  const size = variant === "title" ? "1536x1024" : "1024x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      background: "transparent",
      output_format: "png",
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    data?: Array<{ b64_json?: string }>;
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI image API error: ${res.status}`);
  }

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  return Buffer.from(b64, "base64");
}
