import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const settingsSchema = z.object({
  action: z.literal("settings"),
  classifierModel: z.enum(["fast", "smart", "think"]),
});

const renameSchema = z.object({
  title: z.string().min(1),
});

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

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.error("[lists/PATCH] invalid json:", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await params;
  console.log(`[lists/PATCH] id=${id} body=${JSON.stringify(body)}`);

  try {
    if (body && typeof body === "object" && (body as { action?: unknown }).action === "settings") {
      const parsed = settingsSchema.parse(body);
      const list = await runSessionRpc("update_list_settings_with_session", {
        p_list_id: id,
        p_classifier_model: parsed.classifierModel,
      });

      return NextResponse.json(list);
    }

    const parsed = renameSchema.parse(body);
    const list = await runSessionRpc("rename_list_with_session", {
      p_list_id: id,
      p_title: parsed.title,
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("[lists/PATCH] failed:", error);
    return NextResponse.json(
      { error: describeError(error) || "Unable to update list" },
      { status: 400 },
    );
  }
}

