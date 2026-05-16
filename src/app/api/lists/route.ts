import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const schema = z.object({
  title: z.string().min(1),
  locale: z.enum(["en", "he"]).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const list = await runSessionRpc("create_list_with_session", {
      p_title: body.title,
      p_locale: body.locale ?? null,
    });

    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create list" },
      { status: 400 },
    );
  }
}

