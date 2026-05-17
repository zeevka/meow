import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchListForSession, runSessionRpc } from "@/lib/custom-auth";

const requestSchema = z.object({
  shareSlug: z.string(),
});

export async function POST(request: Request) {
  try {
    const { shareSlug } = requestSchema.parse(await request.json());

    const payload = await fetchListForSession(shareSlug);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targets = payload.items.filter(
      (item) =>
        item.deleted_at == null &&
        item.category != null &&
        item.category_source === "ai",
    );

    if (targets.length === 0) {
      return NextResponse.json({ updated: [] });
    }

    const itemIds = targets.map((item) => item.id);
    const updates = targets.map((item) => ({
      id: item.id,
      category: null,
      customLabel: null,
    }));

    const result = await runSessionRpc<unknown[]>(
      "bulk_update_list_item_categories_with_session",
      {
        p_list_id: payload.list.id,
        p_item_ids: itemIds,
        p_updates: updates,
        p_device_id: "server-clear-categories",
        p_mutation_id: crypto.randomUUID(),
      },
    );

    return NextResponse.json({ updated: result ?? [] });
  } catch (error) {
    console.error("[clear-categories] handler error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to clear categories" },
      { status: 400 },
    );
  }
}
