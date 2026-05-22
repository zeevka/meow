import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const createSchema = z.object({
  label: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const { label, color } = createSchema.parse(await request.json());

    const created = await runSessionRpc("create_list_category_with_session", {
      p_list_id: id,
      p_label: label,
      p_color: color ?? null,
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("[lists/categories POST] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create category" },
      { status: 400 },
    );
  }
}
