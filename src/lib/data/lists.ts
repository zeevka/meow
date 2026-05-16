import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeProductName } from "@/lib/normalize";
import type {
  ListItemRecord,
  ListPayload,
  ListRecord,
  MemberRecord,
  OfflineMutation,
  ProfileRecord,
  Viewer,
} from "@/lib/types";

type RpcListResult = ListRecord;
type RpcItemResult = ListItemRecord;

export const listQueryKey = (shareSlug: string) => ["list", shareSlug] as const;
export const dashboardQueryKey = ["dashboard"] as const;

export async function fetchListPayloadBySlug(
  supabase: SupabaseClient,
  viewer: Viewer,
  shareSlug: string,
): Promise<ListPayload> {
  const [profile, listResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, full_name, avatar_url, locale, created_at")
      .eq("id", viewer.id)
      .maybeSingle(),
    supabase
      .from("lists")
      .select("*")
      .eq("share_slug", shareSlug)
      .maybeSingle(),
  ]);

  if (profile.error) {
    throw profile.error;
  }

  if (listResult.error) {
    throw listResult.error;
  }

  if (!listResult.data) {
    throw new Error("List not found");
  }

  const list = listResult.data as ListRecord;

  const [membersResult, itemsResult] = await Promise.all([
    supabase
      .from("list_members")
      .select("list_id, user_id, role, joined_at, added_via_link")
      .eq("list_id", list.id)
      .order("joined_at"),
    supabase
      .from("list_items")
      .select("*")
      .eq("list_id", list.id)
      .is("deleted_at", null)
      .order("sort_index")
      .order("created_at"),
  ]);

  if (membersResult.error) {
    throw membersResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const members = (membersResult.data ?? []) as Omit<MemberRecord, "profile">[];
  const memberIds = members.map((member) => member.user_id);
  const profilesResult =
    memberIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, first_name, full_name, avatar_url, locale, created_at")
          .in("id", memberIds)
      : { data: [], error: null };

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  const profileMap = new Map<string, ProfileRecord>();
  for (const record of profilesResult.data ?? []) {
    profileMap.set(record.id, record);
  }

  return {
    profile: profile.data,
    viewer,
    list,
    members: members.map((member) => ({
      ...member,
      profile: profileMap.get(member.user_id) ?? null,
    })),
    items: (itemsResult.data ?? []) as ListItemRecord[],
  };
}

export async function createList(
  supabase: SupabaseClient,
  title: string,
  locale: string | null,
) {
  const { data, error } = await supabase.rpc("create_list", {
    p_title: title,
    p_locale: locale,
  });

  if (error) {
    throw error;
  }

  return data as RpcListResult;
}

export async function renameList(
  supabase: SupabaseClient,
  listId: string,
  title: string,
) {
  const { data, error } = await supabase.rpc("rename_list", {
    p_list_id: listId,
    p_title: title,
  });

  if (error) {
    throw error;
  }

  return data as RpcListResult;
}

export async function joinListBySlug(
  supabase: SupabaseClient,
  shareSlug: string,
) {
  const { data, error } = await supabase.rpc("join_list_by_slug", {
    p_share_slug: shareSlug,
  });

  if (error) {
    throw error;
  }

  return data as ListRecord | null;
}

export async function addListItem(
  supabase: SupabaseClient,
  params: {
    listId: string;
    itemId: string;
    name: string;
    sortIndex: number;
    deviceId: string;
    mutationId: string;
  },
) {
  const { data, error } = await supabase.rpc("add_list_item", {
    p_list_id: params.listId,
    p_item_id: params.itemId,
    p_name: params.name,
    p_sort_index: params.sortIndex,
    p_device_id: params.deviceId,
    p_mutation_id: params.mutationId,
  });

  if (error) {
    throw error;
  }

  return data as RpcItemResult;
}

export async function updateListItemName(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    name: string;
    deviceId: string;
    mutationId: string;
  },
) {
  const { data, error } = await supabase.rpc("update_list_item_name", {
    p_item_id: params.itemId,
    p_name: params.name,
    p_device_id: params.deviceId,
    p_mutation_id: params.mutationId,
  });

  if (error) {
    throw error;
  }

  return data as RpcItemResult;
}

export async function archiveListItem(
  supabase: SupabaseClient,
  params: { itemId: string; deviceId: string; mutationId: string },
) {
  const { data, error } = await supabase.rpc("archive_list_item", {
    p_item_id: params.itemId,
    p_device_id: params.deviceId,
    p_mutation_id: params.mutationId,
  });

  if (error) {
    throw error;
  }

  return data as RpcItemResult;
}

export async function restoreArchivedItem(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    sortIndex: number;
    deviceId: string;
    mutationId: string;
  },
) {
  const { data, error } = await supabase.rpc("restore_archived_item", {
    p_item_id: params.itemId,
    p_sort_index: params.sortIndex,
    p_device_id: params.deviceId,
    p_mutation_id: params.mutationId,
  });

  if (error) {
    throw error;
  }

  return data as RpcItemResult;
}

export async function deleteListItem(
  supabase: SupabaseClient,
  params: { itemId: string; deviceId: string; mutationId: string },
) {
  const { data, error } = await supabase.rpc("delete_list_item", {
    p_item_id: params.itemId,
    p_device_id: params.deviceId,
    p_mutation_id: params.mutationId,
  });

  if (error) {
    throw error;
  }

  return data as RpcItemResult;
}

export async function updateProfileLocale(
  supabase: SupabaseClient,
  locale: "en" | "he",
) {
  const { error } = await supabase
    .from("profiles")
    .update({ locale })
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");

  if (error) {
    throw error;
  }
}

export async function replayOfflineMutation(
  supabase: SupabaseClient,
  mutation: OfflineMutation,
) {
  switch (mutation.kind) {
    case "add":
      return addListItem(supabase, {
        listId: mutation.listId,
        itemId: mutation.itemId,
        name: mutation.name,
        sortIndex: mutation.sortIndex,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "updateName":
      return updateListItemName(supabase, {
        itemId: mutation.itemId,
        name: mutation.name,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "archive":
      return archiveListItem(supabase, {
        itemId: mutation.itemId,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "restore":
      return restoreArchivedItem(supabase, {
        itemId: mutation.itemId,
        sortIndex: mutation.sortIndex,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "delete":
      return deleteListItem(supabase, {
        itemId: mutation.itemId,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
  }
}

export function applyOptimisticAdd(
  payload: ListPayload,
  params: {
    itemId: string;
    name: string;
    sortIndex: number;
    viewerId: string;
    mutationId: string;
    deviceId: string;
    queued: boolean;
  },
) {
  const now = new Date().toISOString();
  const nextItem: ListItemRecord = {
    id: params.itemId,
    list_id: payload.list.id,
    name: params.name,
    normalized_name: normalizeProductName(params.name),
    status: "active",
    sort_index: params.sortIndex,
    created_by: params.viewerId,
    updated_by: params.viewerId,
    archived_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    last_mutation_id: params.mutationId,
    last_mutation_device_id: params.deviceId,
    _optimistic: true,
    _queued: params.queued,
  };

  return {
    ...payload,
    items: [...payload.items, nextItem].sort(
      (left, right) => left.sort_index - right.sort_index,
    ),
  };
}

export function applyOptimisticItemChange(
  payload: ListPayload,
  itemId: string,
  updater: (item: ListItemRecord) => ListItemRecord | null,
) {
  return {
    ...payload,
    items: payload.items
      .map((item) => (item.id === itemId ? updater(item) : item))
      .filter(Boolean) as ListItemRecord[],
  };
}

