"use client";

import { Check, PencilLine, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { copy, type AppLocale } from "@/lib/i18n";
import type { ListItemRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ItemRowProps = {
  locale: AppLocale;
  item: ListItemRecord;
  onRename: (itemId: string, name: string) => Promise<void> | void;
  onArchive: (itemId: string) => Promise<void> | void;
  onRestore: (itemId: string) => Promise<void> | void;
  onDelete: (itemId: string) => Promise<void> | void;
};

export function ItemRow({
  locale,
  item,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}: ItemRowProps) {
  const t = copy[locale];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.name);
  const [translateX, setTranslateX] = useState(0);
  const [pointerStart, setPointerStart] = useState<number | null>(null);

  const isArchived = item.status === "archived";

  return (
    <div className="relative overflow-hidden rounded-[24px]">
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center rounded-[24px] bg-tomato text-paper">
        <Trash2 className="h-4 w-4" />
      </div>

      <div
        className={cn(
          "flex items-center gap-3 rounded-[24px] border border-olive/10 bg-white/88 px-4 py-3 transition",
          isArchived && "opacity-80",
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={(event) => {
          if (event.pointerType === "touch") {
            setPointerStart(event.clientX);
          }
        }}
        onPointerMove={(event) => {
          if (pointerStart === null) {
            return;
          }

          const delta = Math.min(0, event.clientX - pointerStart);
          setTranslateX(Math.max(delta, -88));
        }}
        onPointerUp={async () => {
          if (translateX <= -72) {
            await onDelete(item.id);
          }

          setTranslateX(0);
          setPointerStart(null);
        }}
        onPointerCancel={() => {
          setTranslateX(0);
          setPointerStart(null);
        }}
      >
        <button
          type="button"
          onClick={() => (isArchived ? onRestore(item.id) : onArchive(item.id))}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border transition",
            isArchived
              ? "border-herb/25 bg-herb/10 text-herb"
              : "border-olive/18 bg-paper text-olive hover:bg-herb/12 hover:text-herb",
          )}
        >
          {isArchived ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                await onRename(item.id, value);
                setEditing(false);
              }}
            >
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-full bg-transparent text-base text-ink outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full text-start"
            >
              <p
                className={cn(
                  "truncate text-base text-ink transition",
                  isArchived && "text-ink/50 line-through",
                )}
              >
                {item.name}
              </p>
              {item._queued ? (
                <p className="mt-1 text-xs text-herb">{t.pendingSync}</p>
              ) : null}
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            className="icon-button"
            onClick={() => setEditing((current) => !current)}
            aria-label={t.renameList}
          >
            <PencilLine className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="icon-button text-tomato hover:bg-tomato/10"
            onClick={() => onDelete(item.id)}
            aria-label={t.delete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

