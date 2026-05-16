import { apiJson } from "@/lib/http";
import { normalizeProductName } from "@/lib/normalize";
import type {
  ListItemRecord,
  ListPayload,
  ListRecord,
  OfflineMutation,
  ProfileRecord,
} from "@/lib/types";

export const listQueryKey = (shareSlug: string) => ["list", shareSlug] as const;
export const dashboardQueryKey = ["dashboard"] as const;

export async function fetchListPayloadBySlug(shareSlug: string): Promise<ListPayload> {
  return apiJson<ListPayload>(`/api/lists/by-slug/${shareSlug}`, {
    method: "GET",
  });
}

export async function createList(title: string, locale: string | null) {
  return apiJson<ListRecord>("/api/lists", {
    method: "POST",
    body: JSON.stringify({ title, locale }),
  });
}

export async function renameList(listId: string, title: string) {
  return apiJson<ListRecord>(`/api/lists/${listId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function updateProfileLocale(locale: "en" | "he") {
  return apiJson<ProfileRecord>("/api/profile/locale", {
    method: "PATCH",
    body: JSON.stringify({ locale }),
  });
}

export async function addListItem(params: {
  listId: string;
  itemId: string;
  name: string;
  sortIndex: number;
  deviceId: string;
  mutationId: string;
}) {
  return apiJson<ListItemRecord>("/api/list-items", {
    method: "POST",
    body: JSON.stringify({
      action: "add",
      ...params,
    }),
  });
}

export async function updateListItemName(params: {
  itemId: string;
  name: string;
  deviceId: string;
  mutationId: string;
}) {
  return apiJson<ListItemRecord>("/api/list-items", {
    method: "POST",
    body: JSON.stringify({
      action: "rename",
      ...params,
    }),
  });
}

export async function archiveListItem(params: {
  itemId: string;
  deviceId: string;
  mutationId: string;
}) {
  return apiJson<ListItemRecord>("/api/list-items", {
    method: "POST",
    body: JSON.stringify({
      action: "archive",
      ...params,
    }),
  });
}

export async function restoreArchivedItem(params: {
  itemId: string;
  sortIndex: number;
  deviceId: string;
  mutationId: string;
}) {
  return apiJson<ListItemRecord>("/api/list-items", {
    method: "POST",
    body: JSON.stringify({
      action: "restore",
      ...params,
    }),
  });
}

export async function deleteListItem(params: {
  itemId: string;
  deviceId: string;
  mutationId: string;
}) {
  return apiJson<ListItemRecord>("/api/list-items", {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      ...params,
    }),
  });
}

export async function replayOfflineMutation(mutation: OfflineMutation) {
  switch (mutation.kind) {
    case "add":
      return addListItem({
        listId: mutation.listId,
        itemId: mutation.itemId,
        name: mutation.name,
        sortIndex: mutation.sortIndex,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "updateName":
      return updateListItemName({
        itemId: mutation.itemId,
        name: mutation.name,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "archive":
      return archiveListItem({
        itemId: mutation.itemId,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "restore":
      return restoreArchivedItem({
        itemId: mutation.itemId,
        sortIndex: mutation.sortIndex,
        deviceId: mutation.deviceId,
        mutationId: mutation.mutationId,
      });
    case "delete":
      return deleteListItem({
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
