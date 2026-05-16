import { cookies } from "next/headers";

import { APP_SESSION_COOKIE, getSessionToken } from "@/lib/auth-session";
import { getSupabaseBaseClient } from "@/lib/supabase/base";
import type {
  DashboardPayload,
  ListPayload,
  ListRecord,
  ListItemRecord,
  ProfileRecord,
  Viewer,
} from "@/lib/types";

type RpcClient = {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: {
      message?: string | null;
      code?: string | null;
      details?: string | null;
      hint?: string | null;
    } | null;
  }>;
};

function getRpcClient(): RpcClient {
  return getSupabaseBaseClient() as unknown as RpcClient;
}

function parseRpcJson<T>(input: unknown): T {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid server response");
  }

  return input as T;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

export async function fetchViewerFromSession() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("get_viewer_by_session", {
    p_session_token: token,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const parsed = parseRpcJson<{
    id: string;
    email: string;
    profile: ProfileRecord | null;
  }>(data);

  return {
    viewer: {
      id: parsed.id,
      email: parsed.email,
    } satisfies Viewer,
    profile: parsed.profile,
  };
}

export async function fetchDashboardForSession() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("get_dashboard_by_session", {
    p_session_token: token,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return parseRpcJson<DashboardPayload>(data);
}

export async function fetchListForSession(shareSlug: string) {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("get_list_payload_by_session", {
    p_session_token: token,
    p_share_slug: shareSlug,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return parseRpcJson<ListPayload>(data);
}

export type AuthPayload = {
  session_token: string;
  viewer: Viewer;
  profile: ProfileRecord | null;
};

export async function signInWithPassword(email: string, password: string) {
  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("login_with_password", {
    p_email: email,
    p_password: password,
  });

  if (error) {
    throw error;
  }

  return parseRpcJson<AuthPayload>(data);
}

export async function signUpWithPassword(
  email: string,
  password: string,
  locale: string,
  firstName: string,
) {
  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("register_with_password", {
    p_email: email,
    p_password: password,
    p_locale: locale,
    p_first_name: firstName,
  });

  if (error) {
    throw error;
  }

  return parseRpcJson<AuthPayload>(data);
}

export async function lookupAuthEmail(email: string) {
  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc("lookup_auth_email", {
    p_email: email,
  });

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;
  return parseRpcJson<{
    account_exists: boolean;
    password_account: boolean;
  }>(result);
}

export async function signOutCurrentSession() {
  const token = await getSessionToken();
  if (!token) {
    return;
  }

  const supabase = getRpcClient();
  await supabase.rpc("sign_out_session", {
    p_session_token: token,
  });
}

type ListActionResponse = {
  list?: ListRecord;
  item?: ListItemRecord;
  profile?: ProfileRecord | null;
};

export async function runSessionRpc<T = unknown>(
  name: string,
  args: Record<string, unknown>,
) {
  const token = await getSessionToken();
  if (!token) {
    throw new Error("Unauthorized");
  }

  const supabase = getRpcClient();
  const { data, error } = await supabase.rpc(name, {
    p_session_token: token,
    ...args,
  });

  if (error) {
    throw error;
  }

  return data as T;
}

export type { DashboardPayload, ListPayload, ListRecord, ListItemRecord, ListActionResponse };
