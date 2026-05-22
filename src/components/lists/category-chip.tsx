"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  CATEGORY_SLUGS,
  CUSTOM_CATEGORY_CHIP_CLASS,
  categoryMeta,
  customCategoryColorStyles,
  getCategoryDisplay,
} from "@/lib/categories";
import { copy, type AppLocale } from "@/lib/i18n";
import type { ListCategoryRecord, ListItemRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryChipProps = {
  item: Pick<ListItemRecord, "category" | "custom_category_label">;
  locale: AppLocale;
  customCategories: ListCategoryRecord[];
  onPick: (category: string | null) => Promise<void> | void;
};

const MENU_WIDTH = 224;

export function CategoryChip({ item, locale, customCategories, onPick }: CategoryChipProps) {
  const t = copy[locale];
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const display = getCategoryDisplay(item, t, customCategories);
  const isRtl = locale === "he";

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const margin = 8;
      const left = isRtl
        ? Math.max(margin, rect.right - MENU_WIDTH)
        : Math.min(window.innerWidth - MENU_WIDTH - margin, rect.left);
      setCoords({ top: rect.bottom + margin, left });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, isRtl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div className="mt-1.5 w-fit">
      <button
        ref={buttonRef}
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition",
          display ? display.chipClass : "border border-olive/18 bg-paper text-ink/64",
        )}
        style={display?.chipStyle}
      >
        {display ? display.label : t.pickCategory}
      </button>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              dir={isRtl ? "rtl" : "ltr"}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                width: MENU_WIDTH,
                zIndex: 50,
              }}
              className="rounded-2xl border border-olive/14 bg-white p-2 shadow-[0_14px_32px_rgba(54,43,33,0.14)]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="px-2 pb-1 text-xs font-medium text-ink/56">{t.pickCategory}</p>
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {CATEGORY_SLUGS.map((slug) => {
                  const labelKey = categoryMeta[slug].labelKey as keyof typeof t;
                  return (
                    <button
                      key={slug}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-start text-sm text-ink/82 transition hover:bg-olive/8"
                      onClick={async () => {
                        await onPick(slug);
                        setOpen(false);
                      }}
                    >
                      <span>{t[labelKey]}</span>
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          slug === "other" ? "border border-olive/26 bg-paper" : "bg-olive/30",
                        )}
                      />
                    </button>
                  );
                })}
                {customCategories.length > 0 ? (
                  <div className="my-1 h-px bg-olive/14" />
                ) : null}
                {customCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-start text-sm text-ink/82 transition hover:bg-olive/8"
                    onClick={async () => {
                      await onPick(cat.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{cat.label}</span>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        CUSTOM_CATEGORY_CHIP_CLASS,
                      )}
                      style={customCategoryColorStyles(cat.color).dotStyle}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  className="flex w-full rounded-xl px-2 py-2 text-start text-sm text-tomato transition hover:bg-tomato/8"
                  onClick={async () => {
                    await onPick(null);
                    setOpen(false);
                  }}
                >
                  {t.clearCategory}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
