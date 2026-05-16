"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { fetchDashboardPayload } from "@/lib/data/dashboard";
import { dashboardQueryKey } from "@/lib/data/lists";
import { createList, updateProfileLocale } from "@/lib/data/lists";
import { copy, getDirection, type AppLocale } from "@/lib/i18n";
import type { DashboardPayload } from "@/lib/types";
import { cn, formatRelativeDate } from "@/lib/utils";

type DashboardClientProps = {
  initialData: DashboardPayload;
};

export function DashboardClient({ initialData }: DashboardClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draftTitle, setDraftTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: dashboardQueryKey,
    initialData,
    queryFn: fetchDashboardPayload,
    refetchInterval: 10000,
  });

  const locale: AppLocale = data.profile?.locale === "he" ? "he" : "en";
  const t = copy[locale];

  const createListMutation = useMutation({
    mutationFn: async () => createList(draftTitle, locale),
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

  const localeMutation = useMutation({
    mutationFn: async () => updateProfileLocale(locale === "en" ? "he" : "en"),
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

          {data.lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.share_slug}`}
              className="paper-panel block p-5 transition hover:border-herb/40 sm:p-6"
            >
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

              <h2 className="display-title mt-4 text-3xl break-words">{list.title}</h2>
              <p className="mt-2 text-sm text-ink/56">
                {formatRelativeDate(list.updated_at)}
              </p>
            </Link>
          ))}
        </main>
      </div>
    </div>
  );
}
