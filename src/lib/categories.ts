export const CATEGORY_SLUGS = [
  "dairy",
  "produce",
  "bakery",
  "meat",
  "pantry",
  "drinks",
  "frozen",
  "household",
  "personal_care",
  "snacks",
  "other",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];
export const DEFAULT_CUSTOM_CATEGORY_COLOR = "#6b5b4b";

export const categoryMeta: Record<
  CategorySlug,
  {
    labelKey: string;
    chipClass: string;
  }
> = {
  dairy: { labelKey: "catDairy", chipClass: "bg-herb/14 text-herb" },
  produce: { labelKey: "catProduce", chipClass: "bg-olive/14 text-olive" },
  bakery: { labelKey: "catBakery", chipClass: "bg-tomato/12 text-tomato" },
  meat: { labelKey: "catMeat", chipClass: "bg-tomato/14 text-tomato" },
  pantry: { labelKey: "catPantry", chipClass: "bg-olive/12 text-olive" },
  drinks: { labelKey: "catDrinks", chipClass: "bg-herb/12 text-herb" },
  frozen: {
    labelKey: "catFrozen",
    chipClass: "bg-paper border border-olive/30 text-olive",
  },
  household: {
    labelKey: "catHousehold",
    chipClass: "bg-olive/10 text-olive",
  },
  personal_care: {
    labelKey: "catPersonalCare",
    chipClass: "bg-tomato/10 text-tomato",
  },
  snacks: { labelKey: "catSnacks", chipClass: "bg-herb/10 text-herb" },
  other: {
    labelKey: "catOther",
    chipClass: "bg-paper border border-olive/16 text-ink/70",
  },
};

export const CUSTOM_CATEGORY_CHIP_CLASS =
  "bg-ink/6 text-ink border border-ink/16";

function parseHexColor(hex: string) {
  const normalized = normalizeCategoryColor(hex);
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }

  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function normalizeCategoryColor(color: string | null | undefined) {
  const value = (color ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value;
  }

  return DEFAULT_CUSTOM_CATEGORY_COLOR;
}

export function customCategoryColorStyles(color: string | null | undefined) {
  const parsed = parseHexColor(color ?? DEFAULT_CUSTOM_CATEGORY_COLOR);
  if (!parsed) {
    return {
      chipStyle: undefined,
      dotStyle: undefined,
    };
  }

  const rgb = `${parsed.r}, ${parsed.g}, ${parsed.b}`;
  return {
    chipStyle: {
      backgroundColor: `rgba(${rgb}, 0.14)`,
      borderColor: `rgba(${rgb}, 0.34)`,
      color: `rgb(${rgb})`,
    },
    dotStyle: {
      backgroundColor: `rgb(${rgb})`,
    },
  };
}

export function isBuiltInCategory(slug: string): slug is CategorySlug {
  return (CATEGORY_SLUGS as readonly string[]).includes(slug);
}

export function getCategoryDisplay(
  item: { category: string | null; custom_category_label: string | null },
  t: Record<string, string>,
  customCategories: { id: string; label: string; color?: string | null }[] = [],
): {
  label: string;
  chipClass: string;
  chipStyle?: { backgroundColor: string; borderColor: string; color: string };
} | null {
  if (!item.category) {
    return null;
  }

  if (isBuiltInCategory(item.category)) {
    const meta = categoryMeta[item.category];
    const label =
      item.category === "other" && item.custom_category_label
        ? item.custom_category_label
        : t[meta.labelKey];
    return { label, chipClass: meta.chipClass };
  }

  const match = customCategories.find((cat) => cat.id === item.category);
  if (match) {
    const { chipStyle } = customCategoryColorStyles(match.color);
    return {
      label: match.label,
      chipClass: CUSTOM_CATEGORY_CHIP_CLASS,
      chipStyle,
    };
  }

  return null;
}
