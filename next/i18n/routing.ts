import { defineRouting } from "next-intl/routing";

export const locales = ["pt", "en"] as const;
export type Locales = typeof locales[number];

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: locales,

  // Used when no locale matches
  defaultLocale: locales[0],
});
