import { cookies } from "next/headers";

export const APP_SESSION_COOKIE = "pantry_session";

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(APP_SESSION_COOKIE)?.value ?? null;
}

