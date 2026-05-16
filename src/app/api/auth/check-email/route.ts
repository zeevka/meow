import { NextResponse } from "next/server";
import { z } from "zod";

import { lookupAuthEmail } from "@/lib/custom-auth";
import { getReadableErrorMessage } from "@/lib/supabase/errors";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await lookupAuthEmail(body.email);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: getReadableErrorMessage(error, "Unable to check email"),
      },
      { status: 400 },
    );
  }
}
