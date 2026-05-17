import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const schema = z.object({
  action: z.enum(["archiveAll", "restoreAll"]),
  listId: z.string().uuid(),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    const rpc =
      body.action === "archiveAll"
        ? "bulk_archive_active_items_with_session"
        : "bulk_restore_archived_items_with_session";

    const updated = await runSessionRpc(rpc, {
      p_list_id: body.listId,
      p_device_id: body.deviceId,
      p_mutation_id: body.mutationId,
    });

    return NextResponse.json({ updated: updated ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk update failed" },
      { status: 400 },
    );
  }
}
