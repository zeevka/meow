import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchListForSession, runSessionRpc } from "@/lib/custom-auth";
import { CATEGORY_SLUGS, type CategorySlug } from "@/lib/categories";
import type { ClassifierModel } from "@/lib/types";

const MODEL_MAP: Record<ClassifierModel, string> = {
  fast: process.env.NVIDIA_MODEL_FAST || "meta/llama-3.1-8b-instruct",
  smart: process.env.NVIDIA_MODEL_SMART || "meta/llama-3.3-70b-instruct",
  think:
    process.env.NVIDIA_MODEL_THINK ||
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
};

const requestSchema = z.object({
  shareSlug: z.string(),
});

const classifierOutputSchema = z.object({
  classifications: z.array(
    z.object({
      i: z.number().int().nonnegative(),
      category: z.string(),
      customLabel: z.string().max(24).optional(),
    }),
  ),
});

async function callNvidiaClassifier(
  names: string[],
  modelChoice: ClassifierModel,
) {
  if (!process.env.NVIDIA_API_KEY) {
    console.error("[classify] NVIDIA_API_KEY is not set in process.env");
    throw new Error("Classifier is not configured (missing NVIDIA_API_KEY)");
  }

  const indexedItems = names.map((name, i) => ({ i, name }));
  const categoryDescriptions = [
    "dairy — EN: milk, cheese, yogurt, butter, cream, cottage / HE: חלב, גבינה, יוגורט, חמאה, שמנת, קוטג'",
    "produce — EN: fruits, vegetables, herbs, salad greens / HE: ירקות, פירות, עשבי תיבול, עגבניות, מלפפון, בצל, תפוחים, בננה, חסה, פטרוזיליה, לימון, גזר, תפוח אדמה",
    "bakery — EN: bread, pita, pastries, tortillas, buns, challah / HE: לחם, פיתה, פיתות, חלה, מאפים, רוגלעך, בורקס, בייגלה, לחמניות",
    "meat — EN: meat, beef, fish, poultry, chicken, deli, sausage / HE: בשר, עוף, דגים, סלמון, טונה, נקניק, נקניקיות, המבורגר, קבב, שניצל",
    "pantry — EN: dry goods, rice, pasta, flour, sugar, salt, spices, oils, vinegar, canned goods, sauces, ketchup / HE: אורז, פסטה, קמח, סוכר, מלח, פלפל שחור, תבלינים, שמן, חומץ, רוטב, קטשופ, מיונז, שימורים, טחינה",
    "drinks — EN: water, soda, juice, tea, coffee, beer, wine, milk-alternatives / HE: מים, מיץ, קוקה קולה, ספרייט, סודה, קפה, תה, בירה, יין, חלב סויה, חלב שקדים",
    "frozen — EN: frozen vegetables, frozen pizza, ice cream, frozen meals / HE: קפואים, ירקות קפואים, פיצה קפואה, גלידה, ארטיק",
    "household — EN: cleaning supplies, bleach, detergent, dish soap, paper goods, trash bags, paper towels, sponges, foil, light bulbs / HE: אקונומיקה, סבון כלים, אבקת כביסה, מרכך כביסה, נייר טואלט, מגבות נייר, מגבונים, שקיות זבל, ספוגים, מטאטא, נייר אלומיניום, נורה",
    "personal_care — EN: shampoo, conditioner, soap, toothpaste, deodorant, vitamins, makeup, diapers / HE: שמפו, מרכך שיער, סבון, משחת שיניים, מברשת שיניים, דאודורנט, ויטמינים, איפור, חיתולים",
    "snacks — EN: chips, cookies, candy, chocolate, crackers, popcorn, gum / HE: חטיף, חטיפים, ביסלי, במבה, צ'יפס, עוגיות, שוקולד, סוכריות, מסטיק, פופקורן",
    "other — use ONLY when none of the categories above truly fit (e.g. hardware tools, electronics, flowers, toys)",
  ].join("\n");

  const model = MODEL_MAP[modelChoice] ?? MODEL_MAP.smart;
  const isNemotron = model.includes("nemotron");
  const timeoutMs = Number(process.env.NVIDIA_TIMEOUT_MS || 60_000);
  console.log(
    `[classify] calling NVIDIA NIM model=${model} reasoning=${isNemotron ? "off" : "n/a"} timeout=${timeoutMs}ms items=${names.length}`,
  );

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: [
              isNemotron ? "detailed thinking off" : "",
              "You classify shopping/pantry list items written in English or Hebrew.",
              "Use ONLY the allowed category slugs listed by the user.",
              "Pick the single best-fitting category. Prefer a real category over 'other' whenever possible.",
              "Return a valid JSON object ONLY — no commentary, no markdown, no <think> tags in the final answer.",
              "customLabel rule: include it ONLY when category='other'. Write it in the SAME script/language as the item name (Hebrew item → Hebrew label; English item → English label). Max 24 characters. Use a short, generic noun — no brands, no quantities, no punctuation.",
            ]
              .filter(Boolean)
              .join(" "),
          },
          {
            role: "user",
            content: [
              "Allowed categories (with English and Hebrew vocabulary):",
              categoryDescriptions,
              "",
              "Return exactly this JSON shape and nothing else:",
              '{"classifications":[{"i":<index>,"category":"<slug>","customLabel":"<short label, only when category=other>"}]}',
              'The "i" field MUST be the integer index of the item from the array below. Return one classification per item.',
              "",
              "Examples (input → category):",
              '- "אקונומיקה" → household (Hebrew word for bleach)',
              '- "סבון כלים" → household',
              '- "במבה" → snacks',
              '- "פיתות" → bakery',
              '- "טחינה" → pantry',
              '- "חלב סויה" → drinks',
              '- "Hammer" → other, customLabel "Hammer"',
              '- "פטיש" → other, customLabel "פטיש"',
              '- "מחשב" → other, customLabel "מחשב"',
              '- "Computer" → other, customLabel "Computer"',
              "",
              "Items to classify:",
              JSON.stringify(indexedItems),
            ].join("\n"),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    console.error(`[classify] fetch to NIM failed after ${elapsed}ms:`, error);
    throw new Error(
      `Classifier network error after ${elapsed}ms (model=${model}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[classify] NIM responded status=${response.status} in ${elapsed}ms`);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "<unable to read body>");
    console.error(`[classify] NIM error body: ${bodyText}`);
    throw new Error(
      `Classifier request failed (${response.status}): ${bodyText.slice(0, 200)}`,
    );
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    console.error("[classify] NIM payload missing content:", JSON.stringify(payload).slice(0, 400));
    throw new Error("Classifier response was invalid (no message content)");
  }

  console.log(`[classify] NIM content (first 300 chars): ${content.slice(0, 300)}`);

  const stripped = stripJsonFences(content);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(stripped);
  } catch (error) {
    console.error("[classify] JSON parse failed:", error, "\nstripped content:", stripped.slice(0, 400));
    throw new Error("Classifier returned invalid JSON");
  }

  const parsed = classifierOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    console.error("[classify] schema validation failed:", parsed.error.flatten(), "\npayload:", JSON.stringify(parsedJson).slice(0, 400));
    throw new Error("Classifier response did not match expected schema");
  }

  const seen = new Set<number>();
  const filtered = parsed.data.classifications.filter((entry) => {
    if (entry.i >= names.length) return false;
    if (seen.has(entry.i)) return false;
    seen.add(entry.i);
    return true;
  });
  console.log(`[classify] returning ${filtered.length} valid classification(s) out of ${parsed.data.classifications.length}`);
  return filtered;
}

function stripJsonFences(raw: string) {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const parts = [obj.message, obj.code, obj.details, obj.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length > 0) {
      return parts.join(" — ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export async function POST(request: Request) {
  try {
    const { shareSlug } = requestSchema.parse(await request.json());
    console.log(`[classify] POST received for shareSlug=${shareSlug}`);

    const payload = await fetchListForSession(shareSlug);
    if (!payload) {
      console.warn(`[classify] no session payload for shareSlug=${shareSlug}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unclassified = payload.items.filter(
      (item) =>
        item.deleted_at == null &&
        (item.category == null || item.category_source === "ai"),
    );
    console.log(
      `[classify] list=${payload.list.id} total=${payload.items.length} unclassified=${unclassified.length}`,
    );

    if (unclassified.length === 0) {
      return NextResponse.json({ updated: [] });
    }

    const deviceId = "server-classify";
    const mutationId = crypto.randomUUID();
    const itemIds = unclassified.map((item) => item.id);

    const modelChoice: ClassifierModel =
      payload.list.classifier_model === "fast" ||
      payload.list.classifier_model === "think" ||
      payload.list.classifier_model === "smart"
        ? payload.list.classifier_model
        : "smart";

    const classifications = await callNvidiaClassifier(
      unclassified.map((item) => item.name),
      modelChoice,
    );

    const updates = classifications.map((classification) => {
      const isAllowed = CATEGORY_SLUGS.includes(classification.category as CategorySlug);
      const category = isAllowed
        ? (classification.category as CategorySlug)
        : "other";

      return {
        id: unclassified[classification.i].id,
        category,
        customLabel:
          category === "other"
            ? (classification.customLabel?.trim() || null)
            : null,
      };
    });

    console.log(`[classify] calling bulk RPC with ${updates.length} update(s)`);
    let result: unknown;
    try {
      result = await runSessionRpc<unknown[]>(
        "bulk_update_list_item_categories_with_session",
        {
          p_list_id: payload.list.id,
          p_item_ids: itemIds,
          p_updates: updates,
          p_device_id: deviceId,
          p_mutation_id: mutationId,
        },
      );
    } catch (error) {
      console.error("[classify] bulk RPC failed:", error);
      throw new Error(`Bulk category update failed: ${describeError(error)}`);
    }

    console.log(`[classify] bulk RPC succeeded`);
    return NextResponse.json({ updated: result ?? [] });
  } catch (error) {
    console.error("[classify] handler error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to classify items" },
      { status: 400 },
    );
  }
}
