"use client";

import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/button";
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
    <form
      onSubmit={onSubmit}
      className="group relative mx-auto w-full max-w-2xl transition-all duration-300 ease-out hover:scale-[1.01]"
    >
      <div className="relative flex h-14 items-center overflow-hidden rounded-full border border-white/20 bg-black/40 shadow-2xl backdrop-blur-md transition-colors corner-squircle focus-within:bg-black/60 hover:border-white/30 hover:bg-black/50">
        <span className="flex h-full w-14 items-center justify-center pl-2">
          <SearchIcon className="h-5 w-5 text-white/70" />
        </span>
        <Input
          key={search}
          type="search"
          name="search"
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          defaultValue={search || ""}
          className="h-full w-full border-0 bg-transparent pr-4 text-lg text-white placeholder:text-white/60 focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {/* Submit Button */}
        <Button
          type="submit"
          size="icon"
          className="absolute right-2 h-10 w-10 rounded-full bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Search"
        >
          <ArrowRightIcon className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
