import { createSharedPathnamesNavigation } from "next-intl/navigation";

export type Locales = "en" | "pt";
export const locales = ["en", "pt"] as const;

export const { Link, redirect, usePathname, useRouter } =
  createSharedPathnamesNavigation({ locales });
