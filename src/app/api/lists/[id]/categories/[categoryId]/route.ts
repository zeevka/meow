import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const renameSchema = z
  .object({
    label: z.string().min(1).max(32).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  })
  .refine((value) => value.label != null || value.color != null, {
    message: "At least one field is required",
  });

type RouteProps = {
  params: Promise<{ id: string; categoryId: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { categoryId } = await params;
    const { label, color } = renameSchema.parse(await request.json());

    const updated = await runSessionRpc("update_list_category_with_session", {
      p_category_id: categoryId,
      p_label: label ?? null,
      p_color: color ?? null,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[lists/categories PATCH] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update category" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  try {
    const { categoryId } = await params;

    const deletedId = await runSessionRpc<string>("delete_list_category_with_session", {
      p_category_id: categoryId,
    });

    return NextResponse.json({ id: deletedId });
  } catch (error) {
    console.error("[lists/categories DELETE] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete category" },
      { status: 400 },
    );
  }
}
