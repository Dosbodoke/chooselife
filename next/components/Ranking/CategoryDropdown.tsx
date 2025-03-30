"use client";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useMemo } from "react";

import { ArrowDownSvg } from "@/assets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type Category } from "./index";

interface Props {
  selectedCategory: Category;
  visibleCategories: Category[];
}

export const CategoryDropdown = ({
  selectedCategory,
  visibleCategories,
}: Props) => {
  const t = useTranslations("highline.tabs.ranking");
  const [, setCategory] = useQueryState("category");

  const categories = useMemo<Record<Category, { label: string }>>(
    () => ({
      speedline: { label: "Speedline" },
      cadenas: { label: t("cadenas") },
      distance: { label: t("distance") },
      fullLine: { label: "Full Lines" },
    }),
    [t]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1 text-xl font-bold leading-none text-gray-900 dark:text-white"
        >
          <ArrowDownSvg className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          <div className="capitalize">{categories[selectedCategory].label}</div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>{t("changeModality")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedCategory}
          onValueChange={(category) => setCategory(category)}
        >
          {visibleCategories.map((category) => (
            <DropdownMenuRadioItem key={category} value={category}>
              {categories[category].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
