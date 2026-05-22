"use client";

import { ArchiveRestore, Check, CheckCheck, Eraser, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  CUSTOM_CATEGORY_CHIP_CLASS,
  DEFAULT_CUSTOM_CATEGORY_COLOR,
  customCategoryColorStyles,
} from "@/lib/categories";
import { copy, type AppLocale } from "@/lib/i18n";
import {
  classifierModels,
  type ClassifierModel,
  type ListCategoryRecord,
} from "@/lib/types";
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
  customCategories: ListCategoryRecord[];
  busyCategoryId: string | null;
  busyCreateCategory: boolean;
  onClose: () => void;
  onSelectModel: (model: ClassifierModel) => void;
  onMarkAllBought: () => void;
  onMarkAllNotBought: () => void;
  onClearCategories: () => void;
  onCreateCategory: (label: string, color: string) => Promise<void> | void;
  onRenameCategory: (id: string, updates: { label?: string; color?: string }) => Promise<void> | void;
  onDeleteCategory: (id: string) => Promise<void> | void;
};

type ColorSwatchInputProps = {
  value: string;
  label: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onBlur?: (finalValue: string) => void;
};

function ColorSwatchInput({
  value,
  label,
  disabled = false,
  onChange,
  onBlur,
}: ColorSwatchInputProps) {
  return (
    <label
      className={cn(
        "relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-olive/24",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
      aria-label={label}
      title={label}
    >
      <span
        className="pointer-events-none absolute inset-[2px] rounded-full"
        style={{ backgroundColor: value }}
      />
      <input
        type="color"
        value={value}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.currentTarget.value)}
      />
    </label>
  );
}

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
  customCategories,
  busyCategoryId,
  busyCreateCategory,
  onClose,
  onSelectModel,
  onMarkAllBought,
  onMarkAllNotBought,
  onClearCategories,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
}: SettingsSheetProps) {
  const t = copy[locale];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [addColor, setAddColor] = useState(DEFAULT_CUSTOM_CATEGORY_COLOR);
  const [colorDrafts, setColorDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setAdding(false);
      setAddDraft("");
      setEditDraft("");
      setAddColor(DEFAULT_CUSTOM_CATEGORY_COLOR);
      setColorDrafts({});
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

  async function submitNew() {
    const value = addDraft.trim();
    if (!value) return;
    await onCreateCategory(value, addColor);
    setAdding(false);
    setAddDraft("");
    setAddColor(DEFAULT_CUSTOM_CATEGORY_COLOR);
  }

  async function submitRename(id: string) {
    const value = editDraft.trim();
    if (!value) return;
    await onRenameCategory(id, { label: value });
    setEditingId(null);
    setEditDraft("");
  }

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

        <section className="mt-6">
          <h3 className="section-title text-sm">{t.categoriesHeading}</h3>
          <p className="mt-1 text-sm text-ink/64">{t.categoriesHint}</p>

          <div className="mt-3 space-y-2">
            {customCategories.length === 0 && !adding ? (
              <p className="rounded-[18px] border border-dashed border-olive/24 bg-white/60 px-3 py-3 text-sm text-ink/56">
                {t.categoriesEmpty}
              </p>
            ) : null}

            {customCategories.map((cat) => {
              const isEditing = editingId === cat.id;
              const isBusy = busyCategoryId === cat.id;
              const currentColor = colorDrafts[cat.id] ?? cat.color ?? DEFAULT_CUSTOM_CATEGORY_COLOR;
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 rounded-[18px] border border-olive/14 bg-white/70 px-3 py-2"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      CUSTOM_CATEGORY_CHIP_CLASS,
                    )}
                    style={customCategoryColorStyles(currentColor).dotStyle}
                  />
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editDraft}
                      maxLength={32}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submitRename(cat.id);
                        } else if (event.key === "Escape") {
                          setEditingId(null);
                          setEditDraft("");
                        }
                      }}
                      className="min-w-0 flex-1 rounded-md border border-olive/20 bg-paper px-2 py-1 text-sm text-ink focus:border-herb focus:outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {cat.label}
                    </span>
                  )}

                  {isBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin text-ink/52" />
                  ) : isEditing ? (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t.categorySave}
                        onClick={() => void submitRename(cat.id)}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t.categoryCancel}
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <ColorSwatchInput
                        value={currentColor}
                        label={t.categoryColor}
                        onChange={(next) =>
                          setColorDrafts((current) => ({
                            ...current,
                            [cat.id]: next,
                          }))
                        }
                        onBlur={(next) => {
                          if (!next || next === (cat.color ?? DEFAULT_CUSTOM_CATEGORY_COLOR)) {
                            return;
                          }

                          void onRenameCategory(cat.id, { color: next });
                          setColorDrafts((current) => {
                            const copied = { ...current };
                            delete copied[cat.id];
                            return copied;
                          });
                        }}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t.categoryRename}
                        disabled={busyCategoryId !== null}
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditDraft(cat.label);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t.categoryDelete}
                        disabled={busyCategoryId !== null}
                        onClick={() => {
                          if (window.confirm(t.categoryDeleteConfirm)) {
                            void onDeleteCategory(cat.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {adding ? (
              <div className="flex items-center gap-2 rounded-[18px] border border-olive/14 bg-white/70 px-3 py-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    CUSTOM_CATEGORY_CHIP_CLASS,
                  )}
                  style={customCategoryColorStyles(addColor).dotStyle}
                />
                <input
                  autoFocus
                  type="text"
                  value={addDraft}
                  maxLength={32}
                  placeholder={t.categoryLabelPlaceholder}
                  onChange={(event) => setAddDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitNew();
                    } else if (event.key === "Escape") {
                      setAdding(false);
                      setAddDraft("");
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-olive/20 bg-paper px-2 py-1 text-sm text-ink focus:border-herb focus:outline-none"
                />
                <ColorSwatchInput
                  value={addColor}
                  label={t.categoryColor}
                  onChange={(next) => setAddColor(next)}
                />
                {busyCreateCategory ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-ink/52" />
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t.categorySave}
                      onClick={() => void submitNew()}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t.categoryCancel}
                      onClick={() => {
                        setAdding(false);
                        setAddDraft("");
                        setAddColor(DEFAULT_CUSTOM_CATEGORY_COLOR);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary w-full justify-center min-h-12"
                disabled={busyCategoryId !== null || busyCreateCategory}
                onClick={() => {
                  setAdding(true);
                  setAddDraft("");
                  setAddColor(DEFAULT_CUSTOM_CATEGORY_COLOR);
                }}
              >
                <Plus className="h-4 w-4" />
                {t.categoryAdd}
              </button>
            )}
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
