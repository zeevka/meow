import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DashboardListRecord,
  DashboardPayload,
  ProfileRecord,
  Viewer,
} from "@/lib/types";

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRecord | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, full_name, avatar_url, locale, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchDashboardPayload(
  supabase: SupabaseClient,
  viewer: Viewer,
): Promise<DashboardPayload> {
  const [profile, membershipsResult] = await Promise.all([
    fetchProfile(supabase, viewer.id),
    supabase
      .from("list_members")
      .select("list_id, role, lists!inner(*)")
      .eq("user_id", viewer.id)
      .order("joined_at", { ascending: false }),
  ]);

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const memberships = (membershipsResult.data ?? []).map((entry) => {
    const listRecord = Array.isArray(entry.lists) ? entry.lists[0] : entry.lists;

    return {
      role: entry.role as DashboardListRecord["role"],
      lists: listRecord as DashboardListRecord,
    };
  });

  const listIds = memberships.map((entry) => entry.lists.id);
  const countsResult =
    listIds.length > 0
      ? await supabase
          .from("list_members")
          .select("list_id")
          .in("list_id", listIds)
      : { data: [], error: null };

  if (countsResult.error) {
    throw countsResult.error;
  }

  const counts = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    counts.set(row.list_id, (counts.get(row.list_id) ?? 0) + 1);
  }

  return {
    profile,
    viewer,
    lists: memberships.map((entry) => ({
      ...entry.lists,
      role: entry.role,
      member_count: counts.get(entry.lists.id) ?? 1,
    })),
  };
}
