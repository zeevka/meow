"use client";

import { ArchiveRestore, CheckCheck, Eraser, LoaderCircle, X } from "lucide-react";
import { useEffect } from "react";

import { copy, type AppLocale } from "@/lib/i18n";
import { classifierModels, type ClassifierModel } from "@/lib/types";
import { cn } from "@/lib/utils";

type SettingsSheetProps = {
  open: boolean;
  locale: AppLocale;
  classifierModel: ClassifierModel;
  savingModel: boolean;
  activeCount: number;
  archivedCount: number;
  aiCategorizedCount: number;
  busyBulk: "archive" | "restore" | "clear" | null;
  onClose: () => void;
  onSelectModel: (model: ClassifierModel) => void;
  onMarkAllBought: () => void;
  onMarkAllNotBought: () => void;
  onClearCategories: () => void;
};

const MODEL_LABEL_KEYS: Record<
  ClassifierModel,
  { label: keyof (typeof copy)["en"]; desc: keyof (typeof copy)["en"] }
> = {
  fast: { label: "aiModelFast", desc: "aiModelFastDesc" },
  smart: { label: "aiModelSmart", desc: "aiModelSmartDesc" },
  think: { label: "aiModelThink", desc: "aiModelThinkDesc" },
};

export function SettingsSheet({
  open,
  locale,
  classifierModel,
  savingModel,
  activeCount,
  archivedCount,
  aiCategorizedCount,
  busyBulk,
  onClose,
  onSelectModel,
  onMarkAllBought,
  onMarkAllNotBought,
  onClearCategories,
}: SettingsSheetProps) {
  const t = copy[locale];

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t.settingsDone}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-lg rounded-t-[32px] border border-olive/16 bg-paper p-5 shadow-[0_24px_60px_rgba(54,43,33,0.24)] sm:m-4 sm:rounded-[32px] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display-title text-2xl">{t.settingsTitle}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={t.settingsDone}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="section-title text-sm">{t.aiModelHeading}</h3>
            {savingModel ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-ink/52" />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink/64">{t.aiModelHint}</p>

          <div className="mt-3 space-y-2">
            {classifierModels.map((model) => {
              const selected = model === classifierModel;
              const keys = MODEL_LABEL_KEYS[model];
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => onSelectModel(model)}
                  disabled={savingModel}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-[22px] border px-4 py-3 text-start transition",
                    selected
                      ? "border-herb/40 bg-herb/10"
                      : "border-olive/14 bg-white/70 hover:bg-olive/8",
                    savingModel && "opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-herb bg-herb text-paper"
                        : "border-olive/30 bg-paper",
                    )}
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-paper" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {t[keys.label]}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/62">
                      {t[keys.desc]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={cn(
              "btn-secondary mt-3 w-full justify-center min-h-12",
              aiCategorizedCount === 0 && "opacity-60",
            )}
            disabled={busyBulk !== null || aiCategorizedCount === 0}
            onClick={onClearCategories}
          >
            {busyBulk === "clear" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Eraser className="h-4 w-4" />
            )}
            {t.clearCategories}
          </button>
        </section>

        <section className="mt-6">
          <h3 className="section-title text-sm">{t.bulkHeading}</h3>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={cn(
                "btn-secondary justify-center min-h-12",
                activeCount === 0 && "opacity-60",
              )}
              disabled={busyBulk !== null || activeCount === 0}
              onClick={onMarkAllBought}
            >
              {busyBulk === "archive" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              {t.markAllBought}
            </button>

            <button
              type="button"
              className={cn(
                "btn-secondary justify-center min-h-12",
                archivedCount === 0 && "opacity-60",
              )}
              disabled={busyBulk !== null || archivedCount === 0}
              onClick={onMarkAllNotBought}
            >
              {busyBulk === "restore" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              {t.markAllNotBought}
            </button>
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t.settingsDone}
          </button>
        </div>
      </div>
    </div>
  );
}
