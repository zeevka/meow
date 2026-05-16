"use client";

import { Plus } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { copy, type AppLocale } from "@/lib/i18n";
import { normalizeProductName, scoreArchivedMatch } from "@/lib/normalize";
import type { ListItemRecord } from "@/lib/types";

type ComposerProps = {
  locale: AppLocale;
  archivedItems: ListItemRecord[];
  onSubmit: (name: string) => Promise<void> | void;
  onRestore: (item: ListItemRecord) => Promise<void> | void;
};

export function Composer({
  locale,
  archivedItems,
  onSubmit,
  onRestore,
}: ComposerProps) {
  const t = copy[locale];
  const [draft, setDraft] = useState("");
  const deferredDraft = useDeferredValue(draft);
  const normalizedDraft = normalizeProductName(deferredDraft);

  const suggestions =
    normalizedDraft.length < 2
      ? []
      : archivedItems
          .map((item) => ({
            item,
            score: scoreArchivedMatch(normalizedDraft, item.name),
          }))
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, 5);

  return (
    <div className="sticky bottom-4 z-20 rounded-[34px] border border-olive/16 bg-paper/94 p-3 shadow-[0_24px_60px_rgba(54,43,33,0.16)] backdrop-blur">
      <form
        className="flex items-center gap-3"
        onSubmit={async (event) => {
          event.preventDefault();

          if (!draft.trim()) {
            return;
          }

          await onSubmit(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.addItemHint}
          className="min-h-12 flex-1 bg-transparent px-4 text-base text-ink outline-none placeholder:text-ink/34"
        />
        <button type="submit" className="btn-primary min-w-[7.5rem]">
          <Plus className="h-4 w-4" />
          {t.addItem}
        </button>
      </form>

      {suggestions.length > 0 ? (
        <div className="mt-3 rounded-[24px] border border-olive/12 bg-white/76 p-2">
          {suggestions.map(({ item }) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-start text-sm text-ink/78 transition hover:bg-olive/8"
              onClick={async () => {
                await onRestore(item);
                setDraft("");
              }}
            >
              <span>{item.name}</span>
              <span className="text-xs text-herb">{t.restore}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

