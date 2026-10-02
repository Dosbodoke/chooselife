"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { HighlineList } from "./HighlineList";
import Search from "./search";

const destinations = [
  { key: "explore", href: "/", active: true },
  { key: "map", href: "/?view=map", active: false },
  { key: "events", href: "/events", active: false },
  { key: "app", href: "/download", active: false },
] as const;

export function HomeBrowseFirst() {
  const t = useTranslations("home.browse");

  return (
    <div
      className="relative z-20 mx-2 max-w-screen-xl space-y-6 md:mx-auto"
      style={{ marginTop: "70dvh" }}
    >
      <Search />

      <section
        aria-labelledby="home-browse-heading"
        className="mx-auto max-w-6xl px-2 pb-16 pt-2 md:px-4 md:pt-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("eyebrow")}
            </p>
            <h2
              id="home-browse-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl"
            >
              {t("title")}
            </h2>
          </div>
          <Link
            href="/?view=map"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            {t("viewMap")}
            <ArrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
          </Link>
        </div>

        <nav
          aria-label={t("navigationLabel")}
          className="mt-7 flex gap-6 overflow-x-auto border-b border-border/70 text-sm font-medium text-muted-foreground"
        >
          {destinations.map(({ key, href, active }) => (
            <Link
              key={key}
              href={href}
              className={
                active
                  ? "shrink-0 border-b-2 border-foreground pb-3 text-foreground"
                  : "shrink-0 pb-3 transition-colors duration-150 ease-out hover:text-foreground"
              }
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="mt-7">
          <HighlineList layout="rail" />
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border/70 pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("summary")}</p>
          <Link
            href="/download"
            className="inline-flex items-center gap-2 font-semibold text-foreground"
          >
            {t("download")}
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
