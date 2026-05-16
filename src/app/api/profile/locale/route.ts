import { NextResponse } from "next/server";
import { z } from "zod";

import { runSessionRpc } from "@/lib/custom-auth";

const schema = z.object({
  locale: z.enum(["en", "he"]),
});

export async function PATCH(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const profile = await runSessionRpc("update_profile_locale_with_session", {
      p_locale: body.locale,
    });

    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update locale" },
      { status: 400 },
    );
  }
}

