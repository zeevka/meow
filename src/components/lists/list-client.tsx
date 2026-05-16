"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  Copy,
  LoaderCircle,
  Signal,
  SignalZero,
} from "lucide-react";
import { useEffect, useState } from "react";

import { CollaboratorChip } from "@/components/lists/collaborator-chip";
import { Composer } from "@/components/lists/composer";
import { ItemRow } from "@/components/lists/item-row";
import {
  addListItem,
  applyOptimisticAdd,
  applyOptimisticItemChange,
  archiveListItem,
  deleteListItem,
  fetchListPayloadBySlug,
  joinListBySlug,
  listQueryKey,
  replayOfflineMutation,
  restoreArchivedItem,
  updateListItemName,
  updateProfileLocale,
} from "@/lib/data/lists";
import {
  enqueueOfflineMutation,
  getDeviceId,
  readOfflineQueue,
  removeOfflineMutation,
} from "@/lib/offline-queue";
import { copy, getDirection, type AppLocale } from "@/lib/i18n";
import { normalizeProductName } from "@/lib/normalize";
import { createClient } from "@/lib/supabase/client";
import type { ListItemRecord, ListPayload, OfflineMutation } from "@/lib/types";
import { isNetworkLikeError } from "@/lib/utils";

type ListClientProps = {
  initialData: ListPayload;
};

export function ListClient({ initialData }: ListClientProps) {
  const queryClient = useQueryClient();
  const [supabase] = useState(() => createClient());
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [online, setOnline] = useState(
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(
    readOfflineQueue(initialData.list.share_slug).length,
  );

  const { data, refetch, isFetching } = useQuery({
    queryKey: listQueryKey(initialData.list.share_slug),
    initialData,
    queryFn: async () =>
      fetchListPayloadBySlug(
        supabase,
        initialData.viewer,
        initialData.list.share_slug,
      ),
  });

  const locale: AppLocale = data.profile?.locale === "he" ? "he" : "en";
  const t = copy[locale];
  const queryKey = listQueryKey(data.list.share_slug);
  const activeItems = data.items.filter((item) => item.status === "active");
  const archivedItems = [...data.items]
    .filter((item) => item.status === "archived")
    .sort((left, right) =>
      (right.archived_at ?? right.updated_at).localeCompare(
        left.archived_at ?? left.updated_at,
      ),
    );

  useEffect(() => {
    function updateOnlineState() {
      setOnline(window.navigator.onLine);
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!online) {
      return;
    }

    let cancelled = false;

    async function flushQueue() {
      const queue = readOfflineQueue(data.list.share_slug);
      if (queue.length === 0) {
        setPendingCount(0);
        return;
      }

      for (const mutation of queue) {
        if (cancelled) {
          return;
        }

        try {
          await replayOfflineMutation(supabase, mutation);
          removeOfflineMutation(data.list.share_slug, mutation.id);
        } catch (error) {
          if (isNetworkLikeError(error)) {
            break;
          }

          removeOfflineMutation(data.list.share_slug, mutation.id);
          await refetch();
        }
      }

      setPendingCount(readOfflineQueue(data.list.share_slug).length);
      await refetch();
    }

    void flushQueue();

    return () => {
      cancelled = true;
    };
  }, [data.list.share_slug, online, refetch, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`list:${data.list.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "lists",
        filter: `id=eq.${data.list.id}`,
      }, () => void refetch())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "list_members",
        filter: `list_id=eq.${data.list.id}`,
      }, () => void refetch())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "list_items",
        filter: `list_id=eq.${data.list.id}`,
      }, () => void refetch())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data.list.id, refetch, supabase]);

  async function runQueuedMutation(
    optimistic: (current: ListPayload) => ListPayload,
    remote: () => Promise<unknown>,
    offlineMutation: OfflineMutation,
  ) {
    const previous = queryClient.getQueryData<ListPayload>(queryKey) ?? data;
    queryClient.setQueryData<ListPayload>(queryKey, optimistic(previous));

    if (!online) {
      enqueueOfflineMutation(offlineMutation);
      setPendingCount(readOfflineQueue(data.list.share_slug).length);
      return;
    }

    try {
      await remote();
      await refetch();
    } catch (error) {
      if (isNetworkLikeError(error)) {
        enqueueOfflineMutation(offlineMutation);
        setPendingCount(readOfflineQueue(data.list.share_slug).length);
        return;
      }

      queryClient.setQueryData(queryKey, previous);
      throw error;
    }
  }

  async function handleAddItem(name: string) {
    const normalized = normalizeProductName(name);
    if (!normalized) {
      return;
    }

    const activeDuplicate = activeItems.find(
      (item) => item.normalized_name === normalized,
    );

    if (activeDuplicate) {
      setNotice(t.alreadyListed);
      return;
    }

    const itemId = crypto.randomUUID();
    const mutationId = crypto.randomUUID();
    const deviceId = getDeviceId();
    const sortIndex =
      Math.max(0, ...data.items.map((item) => item.sort_index)) + 1;

    await runQueuedMutation(
      (current) =>
        applyOptimisticAdd(current, {
          itemId,
          name,
          sortIndex,
          viewerId: data.viewer.id,
          mutationId,
          deviceId,
          queued: !online,
        }),
      () =>
        addListItem(supabase, {
          listId: data.list.id,
          itemId,
          name,
          sortIndex,
          deviceId,
          mutationId,
        }),
      {
        id: crypto.randomUUID(),
        shareSlug: data.list.share_slug,
        kind: "add",
        listId: data.list.id,
        itemId,
        name,
        sortIndex,
        deviceId,
        mutationId,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async function handleRenameItem(itemId: string, name: string) {
    const mutationId = crypto.randomUUID();
    const deviceId = getDeviceId();

    await runQueuedMutation(
      (current) =>
        applyOptimisticItemChange(current, itemId, (item) => ({
          ...item,
          name,
          normalized_name: normalizeProductName(name),
          _optimistic: true,
          _queued: !online,
        })),
      () =>
        updateListItemName(supabase, {
          itemId,
          name,
          deviceId,
          mutationId,
        }),
      {
        id: crypto.randomUUID(),
        shareSlug: data.list.share_slug,
        kind: "updateName",
        itemId,
        name,
        deviceId,
        mutationId,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async function handleArchiveItem(itemId: string) {
    const mutationId = crypto.randomUUID();
    const deviceId = getDeviceId();

    await runQueuedMutation(
      (current) =>
        applyOptimisticItemChange(current, itemId, (item) => ({
          ...item,
          status: "archived",
          archived_at: new Date().toISOString(),
          _optimistic: true,
          _queued: !online,
        })),
      () =>
        archiveListItem(supabase, {
          itemId,
          deviceId,
          mutationId,
        }),
      {
        id: crypto.randomUUID(),
        shareSlug: data.list.share_slug,
        kind: "archive",
        itemId,
        deviceId,
        mutationId,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async function handleRestoreItem(itemOrId: string | ListItemRecord) {
    const item = typeof itemOrId === "string"
      ? data.items.find((entry) => entry.id === itemOrId)
      : itemOrId;

    if (!item) {
      return;
    }

    const duplicateActive = activeItems.find(
      (entry) =>
        entry.id !== item.id &&
        entry.normalized_name === normalizeProductName(item.name),
    );

    if (duplicateActive) {
      setNotice(t.alreadyListed);
      return;
    }

    const mutationId = crypto.randomUUID();
    const deviceId = getDeviceId();
    const sortIndex =
      Math.max(0, ...data.items.map((entry) => entry.sort_index)) + 1;

    await runQueuedMutation(
      (current) =>
        applyOptimisticItemChange(current, item.id, (entry) => ({
          ...entry,
          status: "active",
          archived_at: null,
          sort_index: sortIndex,
          _optimistic: true,
          _queued: !online,
        })),
      () =>
        restoreArchivedItem(supabase, {
          itemId: item.id,
          sortIndex,
          deviceId,
          mutationId,
        }),
      {
        id: crypto.randomUUID(),
        shareSlug: data.list.share_slug,
        kind: "restore",
        itemId: item.id,
        sortIndex,
        deviceId,
        mutationId,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async function handleDeleteItem(itemId: string) {
    const mutationId = crypto.randomUUID();
    const deviceId = getDeviceId();

    await runQueuedMutation(
      (current) => applyOptimisticItemChange(current, itemId, () => null),
      () =>
        deleteListItem(supabase, {
          itemId,
          deviceId,
          mutationId,
        }),
      {
        id: crypto.randomUUID(),
        shareSlug: data.list.share_slug,
        kind: "delete",
        itemId,
        deviceId,
        mutationId,
        createdAt: new Date().toISOString(),
      },
    );
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/lists/${data.list.share_slug}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleLocaleToggle() {
    const nextLocale = locale === "en" ? "he" : "en";
    await updateProfileLocale(supabase, nextLocale);
    queryClient.setQueryData<ListPayload>(queryKey, {
      ...data,
      profile: data.profile ? { ...data.profile, locale: nextLocale } : data.profile,
    });
  }

  async function handleJoinRetry() {
    await joinListBySlug(supabase, data.list.share_slug);
    await refetch();
  }

  return (
    <div dir={getDirection(locale)} className="page-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-5 sm:px-8 lg:flex-row lg:items-start lg:gap-10">
        <main className="w-full lg:max-w-[48rem]">
          <section className="paper-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow">{t.appName}</span>
                  <span className="rounded-full bg-herb/12 px-3 py-1 text-xs font-medium text-herb">
                    {data.list.is_link_sharing_enabled ? t.shareEnabled : "Private"}
                  </span>
                </div>
                <h1 className="display-title mt-3 truncate text-4xl sm:text-5xl">
                  {data.list.title}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="icon-button" onClick={handleLocaleToggle}>
                  {locale === "en" ? "עב" : "EN"}
                </button>
                <button type="button" className="btn-secondary" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                  {copied ? t.copied : t.shareList}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {data.members.slice(0, 3).map((member) => (
                <CollaboratorChip key={member.user_id} member={member} />
              ))}
              {data.members.length > 3 ? (
                <div className="flex h-9 min-w-9 items-center justify-center rounded-full border border-olive/16 bg-paper px-3 text-xs font-medium text-ink">
                  +{data.members.length - 3}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ink/62">
              <span className="inline-flex items-center gap-2">
                {online ? (
                  <Signal className="h-4 w-4 text-herb" />
                ) : (
                  <SignalZero className="h-4 w-4 text-tomato" />
                )}
                {online ? t.online : t.offline}
              </span>
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-2 text-herb">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {pendingCount} {t.pendingSync}
                </span>
              ) : null}
              {isFetching ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Syncing
                </span>
              ) : null}
            </div>
          </section>

          <section className="mt-4 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="section-title">{t.activeItems}</h2>
              <span className="text-sm text-ink/52">{activeItems.length}</span>
            </div>

            {activeItems.length === 0 ? (
              <div className="paper-panel p-8 text-center text-sm text-ink/64">
                {t.emptyList}
              </div>
            ) : (
              <div className="space-y-3">
                {activeItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    locale={locale}
                    item={item}
                    onRename={handleRenameItem}
                    onArchive={handleArchiveItem}
                    onRestore={handleRestoreItem}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[26px] border border-olive/14 bg-paper/66 px-5 py-4 text-start"
              onClick={() => setArchiveOpen((current) => !current)}
            >
              <span className="inline-flex items-center gap-3">
                <Archive className="h-4 w-4 text-olive/70" />
                <span className="section-title">{t.boughtItems}</span>
              </span>
              <span className="text-sm text-ink/52">{archivedItems.length}</span>
            </button>

            {archiveOpen ? (
              <div className="space-y-3">
                {archivedItems.length === 0 ? (
                  <div className="paper-panel p-6 text-sm text-ink/64">{t.archivedHint}</div>
                ) : (
                  archivedItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      locale={locale}
                      item={item}
                      onRename={handleRenameItem}
                      onArchive={handleArchiveItem}
                      onRestore={handleRestoreItem}
                      onDelete={handleDeleteItem}
                    />
                  ))
                )}
              </div>
            ) : null}
          </section>

          <div className="mt-6">
            <Composer
              locale={locale}
              archivedItems={archivedItems}
              onSubmit={handleAddItem}
              onRestore={handleRestoreItem}
            />
          </div>

          {notice ? (
            <div className="mt-4 rounded-[22px] border border-tomato/18 bg-tomato/8 px-4 py-3 text-sm text-tomato">
              {notice}
            </div>
          ) : null}
        </main>

        <aside className="w-full lg:max-w-[20rem]">
          <section className="paper-panel p-6">
            <h2 className="section-title">List notes</h2>
            <div className="mt-5 space-y-3 text-sm text-ink/70">
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-herb" />
                {data.members.length} collaborators connected
              </p>
              <p>{t.archivedHint}</p>
            </div>
            <button className="btn-ghost mt-5" type="button" onClick={handleJoinRetry}>
              Refresh membership
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
