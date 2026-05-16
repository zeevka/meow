import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const addSchema = z.object({
  action: z.literal("add"),
  listId: z.string().uuid(),
  itemId: z.string().uuid(),
  name: z.string().min(1),
  sortIndex: z.number(),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

const renameSchema = z.object({
  action: z.literal("rename"),
  itemId: z.string().uuid(),
  name: z.string().min(1),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

const archiveSchema = z.object({
  action: z.literal("archive"),
  itemId: z.string().uuid(),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

const restoreSchema = z.object({
  action: z.literal("restore"),
  itemId: z.string().uuid(),
  sortIndex: z.number(),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

const deleteSchema = z.object({
  action: z.literal("delete"),
  itemId: z.string().uuid(),
  deviceId: z.string(),
  mutationId: z.string().uuid(),
});

const schema = z.discriminatedUnion("action", [
  addSchema,
  renameSchema,
  archiveSchema,
  restoreSchema,
  deleteSchema,
]);

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());

    switch (body.action) {
      case "add":
        return NextResponse.json(
          await runSessionRpc("add_list_item_with_session", {
            p_list_id: body.listId,
            p_item_id: body.itemId,
            p_name: body.name,
            p_sort_index: body.sortIndex,
            p_device_id: body.deviceId,
            p_mutation_id: body.mutationId,
          }),
        );
      case "rename":
        return NextResponse.json(
          await runSessionRpc("update_list_item_name_with_session", {
            p_item_id: body.itemId,
            p_name: body.name,
            p_device_id: body.deviceId,
            p_mutation_id: body.mutationId,
          }),
        );
      case "archive":
        return NextResponse.json(
          await runSessionRpc("archive_list_item_with_session", {
            p_item_id: body.itemId,
            p_device_id: body.deviceId,
            p_mutation_id: body.mutationId,
          }),
        );
      case "restore":
        return NextResponse.json(
          await runSessionRpc("restore_archived_item_with_session", {
            p_item_id: body.itemId,
            p_sort_index: body.sortIndex,
            p_device_id: body.deviceId,
            p_mutation_id: body.mutationId,
          }),
        );
      case "delete":
        return NextResponse.json(
          await runSessionRpc("delete_list_item_with_session", {
            p_item_id: body.itemId,
            p_device_id: body.deviceId,
            p_mutation_id: body.mutationId,
          }),
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update item" },
      { status: 400 },
    );
  }
}
