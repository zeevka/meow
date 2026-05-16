"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { dashboardQueryKey } from "@/lib/data/lists";
import { createList, renameList, updateProfileLocale } from "@/lib/data/lists";
import { copy, getDirection, type AppLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { DashboardPayload } from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";

type DashboardClientProps = {
  initialData: DashboardPayload;
};

export function DashboardClient({ initialData }: DashboardClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draftTitle, setDraftTitle] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const { data } = useQuery({
    queryKey: dashboardQueryKey,
    initialData,
    queryFn: async () => initialData,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const locale: AppLocale = data.profile?.locale === "he" ? "he" : "en";
  const t = copy[locale];

  const createListMutation = useMutation({
    mutationFn: async () => createList(supabase, draftTitle, locale),
    onSuccess: (list) => {
      queryClient.setQueryData<DashboardPayload>(dashboardQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: [
            {
              ...list,
              role: "owner",
              member_count: 1,
            },
            ...current.lists,
          ],
        };
      });

      setDraftTitle("");
      router.push(`/lists/${list.share_slug}`);
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Unable to create list");
    },
  });

  const renameListMutation = useMutation({
    mutationFn: async (input: { listId: string; title: string }) =>
      renameList(supabase, input.listId, input.title),
    onSuccess: (nextList) => {
      queryClient.setQueryData<DashboardPayload>(dashboardQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lists: current.lists.map((list) =>
            list.id === nextList.id ? { ...list, title: nextList.title } : list,
          ),
        };
      });

      setEditingListId(null);
      setEditingValue("");
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Unable to rename list");
    },
  });

  const localeMutation = useMutation({
    mutationFn: async () => updateProfileLocale(supabase, locale === "en" ? "he" : "en"),
    onSuccess: () => {
      queryClient.setQueryData<DashboardPayload>(dashboardQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          profile: current.profile
            ? {
                ...current.profile,
                locale: current.profile.locale === "he" ? "en" : "he",
              }
            : current.profile,
        };
      });
    },
  });

  return (
    <div dir={getDirection(locale)} className="page-shell">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:flex-row lg:gap-10">
        <aside className="w-full lg:max-w-[22rem]">
          <section className="paper-panel p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{t.appName}</p>
                <h1 className="display-title mt-3 text-4xl">{t.listsTitle}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => localeMutation.mutate()}
                  className="icon-button"
                  aria-label="Switch language"
                >
                  <Globe className="h-4 w-4" />
                </button>
                <SignOutButton />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink/72">{t.dashboardIntro}</p>

            <form
              className="mt-8 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draftTitle.trim()) {
                  return;
                }

                createListMutation.mutate();
              }}
            >
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={locale === "he" ? "רשימת סוף שבוע" : "Weekend market run"}
                className="field-input"
              />
              <button
                type="submit"
                disabled={createListMutation.isPending || !draftTitle.trim()}
                className="btn-primary w-full"
              >
                <Plus className="h-4 w-4" />
                {t.createList}
              </button>
            </form>

            {message ? <p className="mt-4 text-sm text-tomato">{message}</p> : null}
          </section>
        </aside>

        <main className="flex-1 space-y-4">
          {data.lists.length === 0 ? (
            <section className="paper-panel flex min-h-[18rem] items-center justify-center p-10 text-center">
              <div className="space-y-3">
                <Sparkles className="mx-auto h-6 w-6 text-herb" />
                <p className="text-base text-ink/70">{t.noLists}</p>
              </div>
            </section>
          ) : null}

          {data.lists.map((list) => {
            const isEditing = editingListId === list.id;

            return (
              <article key={list.id} className="paper-panel p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          list.role === "owner"
                            ? "bg-herb/14 text-herb"
                            : "bg-olive/12 text-olive",
                        )}
                      >
                        {list.role === "owner" ? t.owned : t.joined}
                      </span>
                      <span className="text-xs text-ink/50">
                        {list.member_count} {t.memberCount}
                      </span>
                    </div>

                    {isEditing ? (
                      <form
                        className="mt-4 flex flex-col gap-2 sm:flex-row"
                        onSubmit={(event) => {
                          event.preventDefault();
                          renameListMutation.mutate({
                            listId: list.id,
                            title: editingValue,
                          });
                        }}
                      >
                        <input
                          autoFocus
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          className="field-input"
                        />
                        <div className="flex gap-2">
                          <button className="btn-secondary" type="submit">
                            {t.save}
                          </button>
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => {
                              setEditingListId(null);
                              setEditingValue("");
                            }}
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h2 className="display-title mt-4 truncate text-3xl">{list.title}</h2>
                        <p className="mt-2 text-sm text-ink/56">
                          {formatRelativeDate(list.updated_at)}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setEditingListId(list.id);
                        setEditingValue(list.title);
                      }}
                    >
                      {t.renameList}
                    </button>
                    <Link href={`/lists/${list.share_slug}`} className="btn-primary">
                      {t.openList}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}

