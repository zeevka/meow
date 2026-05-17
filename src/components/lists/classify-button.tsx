"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

import { copy, type AppLocale } from "@/lib/i18n";
import type { ListItemRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type ClassifyButtonProps = {
  activeItems: ListItemRecord[];
  online: boolean;
  isClassifying: boolean;
  locale: AppLocale;
  onClick: () => Promise<void> | void;
};

export function ClassifyButton({
  activeItems,
  online,
  isClassifying,
  locale,
  onClick,
}: ClassifyButtonProps) {
  if (activeItems.length === 0) {
    return null;
  }

  const t = copy[locale];
  const classifiedCount = activeItems.filter((item) => item.category !== null).length;

  let label: string = t.classifyAi;
  if (classifiedCount === activeItems.length) {
    label = t.reclassify;
  } else if (classifiedCount > 0) {
    label = t.classifyNew;
  }

  return (
    <button
      type="button"
      className={cn("btn-secondary min-h-11 px-4 text-sm", !online && "opacity-60")}
      onClick={() => void onClick()}
      disabled={!online || isClassifying}
    >
      {isClassifying ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}
