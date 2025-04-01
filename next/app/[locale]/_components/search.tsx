"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { Input } from "@/components/ui/input";

export default function Search() {
  const t = useTranslations("home");
  const [search, setSearch] = useQueryState("q");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const val = e.target as HTMLFormElement;
    const searchInput = val.search as HTMLInputElement;
    if (searchInput.value) {
      setSearch(searchInput.value);
    } else {
      setSearch(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative mx-auto w-full sm:w-3/5">
      <span className="absolute inset-y-0 start-0 flex items-center justify-center px-2">
        <SearchIcon className="h-6 w-6 text-muted-foreground" />
      </span>
      <Input
        key={search}
        type="search"
        name="search"
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        defaultValue={search || ""}
        className="bg-transparent pl-10 text-base"
      />
    </form>
  );
}
