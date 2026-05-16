import { NextResponse } from "next/server";
import { z } from "zod";

import { APP_SESSION_COOKIE } from "@/lib/auth-session";
import { signUpWithPassword } from "@/lib/custom-auth";
import { getReadableErrorMessage } from "@/lib/supabase/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1).max(80),
  locale: z.enum(["en", "he"]).default("en"),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const auth = await signUpWithPassword(
      body.email,
      body.password,
      body.locale,
      body.firstName,
    );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(APP_SESSION_COOKIE, auth.session_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: getReadableErrorMessage(error, "Unable to create account"),
      },
      { status: 400 },
    );
  }
}
