import { NextResponse } from "next/server";
import { z } from "zod";

import { APP_SESSION_COOKIE } from "@/lib/auth-session";
import { signInWithPassword } from "@/lib/custom-auth";
import { getReadableErrorMessage } from "@/lib/supabase/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const auth = await signInWithPassword(body.email, body.password);
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
        error: getReadableErrorMessage(error, "Unable to sign in"),
      },
      { status: 400 },
    );
  }
}
