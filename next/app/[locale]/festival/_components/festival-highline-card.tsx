"use client";

import type { FestivalHighlineScheduleCard } from "@chooselife/ui";
import {
  ChevronRightIcon,
  MegaphoneIcon,
  MoveHorizontalIcon,
  MoveVerticalIcon,
  UsersIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import HighlineImage from "@/components/HighlineImage";
import { Button } from "@/components/ui/button";

import { FestivalScheduleDrawer } from "./schedule-drawer";

interface Props {
  card: FestivalHighlineScheduleCard;
  festivalSlug: string;
  festivalTimeZone: string;
  viewerCanManage: boolean;
  viewerUserId?: string;
}

function StatPill({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white backdrop-blur-sm">
      <Icon className="h-3 w-3" />
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

export function FestivalHighlineCard({
  card,
  festivalSlug,
  festivalTimeZone,
  viewerCanManage,
  viewerUserId,
}: Props) {
  const t = useTranslations("festival.schedule");
  const locale = useLocale();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isAuthenticated = !!viewerUserId;
  const featuredLabel = card.featuredSlot
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: festivalTimeZone,
      }).format(new Date(card.featuredSlot.startAt))
    : null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        className="w-full max-w-[22rem] cursor-pointer overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
        onClick={() => setIsDrawerOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsDrawerOpen(true);
          }
        }}
      >
        <div className="relative h-52 overflow-hidden">
          <HighlineImage coverImageId={card.highline.cover_image} />

          <div className="absolute inset-0 bg-[rgba(4,8,15,0.18)]" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#070f1a]/95 via-[#070f1a]/65 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 space-y-3 p-4">
            <h3 className="line-clamp-2 text-2xl font-extrabold leading-tight text-white">
              {card.highline.name}
            </h3>

            <div className="flex flex-wrap gap-2">
              <StatPill
                icon={MoveVerticalIcon}
                value={`${card.highline.height.toFixed(0)}m`}
              />
              <StatPill
                icon={MoveHorizontalIcon}
                value={`${card.highline.length.toFixed(0)}m`}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <UsersIcon className="h-3 w-3 shrink-0 text-black" />
              <p className="truncate text-sm font-semibold uppercase tracking-[1px] text-slate-500">
                {t("availableCountLabel", {
                  count: card.availableCount,
                })}
              </p>
            </div>

            {card.featuredSlot?.booking ? (
              <div className="flex max-w-[56%] items-center gap-1.5">
                <MegaphoneIcon className="h-3 w-3 shrink-0 text-green-500" />
                <p className="truncate text-sm font-semibold text-green-500">
                  {card.featuredSlot.isCurrent ? t("current") : featuredLabel}:{" "}
                  {card.featuredSlot.booking.participant.primaryText}
                </p>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            className="h-12 w-full justify-between rounded-2xl bg-[#101b2b] px-4 text-white hover:bg-[#101b2b]/95"
            onClick={(event) => {
              event.stopPropagation();
              setIsDrawerOpen(true);
            }}
          >
            <span className="font-semibold">{t("openSchedule")}</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </article>

      <FestivalScheduleDrawer
        canManage={viewerCanManage}
        card={isDrawerOpen ? card : null}
        festivalSlug={festivalSlug}
        festivalTimeZone={festivalTimeZone}
        isAuthenticated={isAuthenticated}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </>
  );
}
