import { NextResponse } from "next/server";

import { APP_SESSION_COOKIE } from "@/lib/auth-session";
import { signOutCurrentSession } from "@/lib/custom-auth";

export async function POST() {
  try {
    await signOutCurrentSession();
  } finally {
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(APP_SESSION_COOKIE);
    return response;
  }
}
