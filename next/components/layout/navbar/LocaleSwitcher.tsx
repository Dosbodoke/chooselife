"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/navigation";
import type { Locales } from "@/navigation";

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale() as unknown as Locales;
  const router = useRouter();
  const pathname = usePathname();

  function onSelectChange(value: string) {
    router.replace(pathname, { locale: value as Locales });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="text-lg">{locale == "pt" ? "🇧🇷" : "🇺🇸"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={onSelectChange}>
          {(["pt", "en"] as const).map((cur) => (
            <DropdownMenuRadioItem key={cur} value={cur}>
              {cur == "pt" ? "🇧🇷 Português" : "🇺🇸 English"}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
