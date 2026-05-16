import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const schema = z.object({
  title: z.string().min(1),
});

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const body = schema.parse(await request.json());
    const { id } = await params;
    const list = await runSessionRpc("rename_list_with_session", {
      p_list_id: id,
      p_title: body.title,
    });

    return NextResponse.json(list);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rename list" },
      { status: 400 },
    );
  }
}

