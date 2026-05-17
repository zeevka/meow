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

export function getCategoryDisplay(
  item: { category: string | null; custom_category_label: string | null },
  t: Record<string, string>,
): { label: string; chipClass: string } | null {
  if (!item.category) {
    return null;
  }

  const meta = categoryMeta[item.category as CategorySlug] ?? categoryMeta.other;
  const label =
    item.category === "other" && item.custom_category_label
      ? item.custom_category_label
      : t[meta.labelKey];

  return { label, chipClass: meta.chipClass };
}
