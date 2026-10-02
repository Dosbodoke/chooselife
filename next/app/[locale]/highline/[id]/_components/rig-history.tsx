"use client";

import {
  getRigSetupStatus,
  type RiggerProfile,
  type RigStatuses,
  type Setup,
  useRigSetup,
  useRiggerProfiles,
} from "@chooselife/ui";
import { CalendarRangeIcon, FrownIcon, UsersIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getR2PublicUrl } from "@/lib/storage/r2";
import { cn } from "@/lib/utils";

import { getAppUrl } from "./app-link";

const MAX_VISIBLE_RIGGERS = 5;

const dotStyles: Record<RigStatuses, string> = {
  planned: "bg-amber-400 border-amber-200",
  rigged: "bg-green-500 border-green-200",
  unrigged: "bg-muted border-muted-foreground",
};

export function RigHistory({ highlineId }: { highlineId: string }) {
  const t = useTranslations("highline.tabs.informations.history");
  const {
    query: { data, isPending },
    latestSetup,
  } = useRigSetup({ highlineID: highlineId });
  const { data: profiles } = useRiggerProfiles(
    data?.flatMap((setup) => setup.riggers) ?? []
  );

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <LoadingSkeleton />
        ) : data && data.length > 0 ? (
          <ol>
            {data.map((setup, index) => (
              <TimelineItem
                key={setup.id}
                setup={setup}
                profiles={profiles}
                isFirst={index === 0}
                isLast={index === data.length - 1}
              />
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <FrownIcon className="mb-3 size-12" />
            <p>{t("empty")}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-1">
        {isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <RigAction highlineId={highlineId} latestSetup={latestSetup} />
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Mirrors the app's rig / edit / unrig action. Rigging forms only exist in
 * the app, so the action deep links into the matching screen there.
 */
function RigAction({
  highlineId,
  latestSetup,
}: {
  highlineId: string;
  latestSetup: Setup[number] | null;
}) {
  const t = useTranslations("highline.tabs.informations.history");

  const action = (() => {
    // An active or overdue setup opens the confirmation sheet for that setup.
    const confirmSetup = getAppUrl(
      `highline/${highlineId}?setupID=${latestSetup?.id}`
    );
    const rigForm = getAppUrl(`highline/${highlineId}/rig`);

    if (latestSetup?.is_rigged) {
      return {
        label: t("action.unrig"),
        color: "text-red-500",
        href: confirmSetup,
      };
    }
    if (latestSetup?.rig_date && !latestSetup.unrigged_at) {
      const isRigDatePast = new Date(latestSetup.rig_date) < new Date();
      return {
        label: t("action.edit"),
        color: "text-amber-500",
        href: isRigDatePast ? confirmSetup : rigForm,
      };
    }
    return { label: t("action.rig"), color: "text-blue-500", href: rigForm };
  })();

  return (
    <>
      <a
        href={action.href}
        className={cn(
          "w-full rounded-lg border-t pt-4 text-center font-semibold transition-colors hover:bg-muted/50",
          action.color
        )}
      >
        {action.label}
      </a>
      <p className="text-center text-xs text-muted-foreground">
        {t("appHint")}
      </p>
    </>
  );
}

function TimelineItem({
  setup,
  profiles,
  isFirst,
  isLast,
}: {
  setup: Setup[number];
  profiles: Map<string, RiggerProfile> | undefined;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTranslations("highline.tabs.informations.history.timeline");
  const locale = useLocale();
  const status = getRigSetupStatus(setup);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(locale === "pt" ? "pt-BR" : "en-US");

  const label = {
    rigged: t("riggedSince"),
    unrigged: t("rigPeriod"),
    planned: t("plannedFor"),
  }[status];

  return (
    <li className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex w-6 flex-col items-center">
        <div
          className={cn("h-3 w-0.5", isFirst ? "bg-transparent" : "bg-border")}
        />
        <div
          className={cn("size-3 rounded-full border-2", dotStyles[status])}
        />
        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border" />}
      </div>

      <div className="flex-1 pb-6">
        <div className="mb-3 space-y-2">
          <p className="font-semibold">{label}</p>
          <CalendarBadge
            date={formatDate(setup.rig_date)}
            endDate={
              status === "unrigged" && setup.unrigged_at
                ? formatDate(setup.unrigged_at)
                : undefined
            }
          />
        </div>
        <Riggers riggers={setup.riggers} profiles={profiles} />
      </div>
    </li>
  );
}

function CalendarBadge({ date, endDate }: { date: string; endDate?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-600 shadow-sm dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400">
      <CalendarRangeIcon className="size-3.5" strokeWidth={2.5} />
      {endDate ? `${date} - ${endDate}` : date}
    </span>
  );
}

function Riggers({
  riggers,
  profiles,
}: {
  riggers: string[];
  profiles: Map<string, RiggerProfile> | undefined;
}) {
  const t = useTranslations("highline.tabs.informations.history");

  if (riggers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UsersIcon className="size-4" />
        {t("noRiggers")}
      </div>
    );
  }

  const visible = riggers.slice(0, MAX_VISIBLE_RIGGERS);
  const extraCount = riggers.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="mr-2 flex -space-x-2">
        {visible.map((id) => (
          <RiggerAvatar key={id} profile={profiles?.get(id)} />
        ))}
        {extraCount > 0 && (
          <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-bold text-muted-foreground shadow-sm">
            +{extraCount}
          </div>
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        {t("riggers", { count: riggers.length })}
      </span>
    </div>
  );
}

function RiggerAvatar({ profile }: { profile: RiggerProfile | undefined }) {
  const picture = profile?.profile_picture;
  // Google sign-in stores the full URL; uploaded pictures store an R2 path.
  const src = picture
    ? /^https?:\/\//.test(picture)
      ? picture
      : getR2PublicUrl("avatars", picture)
    : "/default-profile-picture.png";
  const name = profile?.username ? `@${profile.username}` : profile?.name;

  return (
    <div
      className="relative size-9 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm"
      title={name ?? undefined}
    >
      <Image
        src={src}
        alt={name ?? ""}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="my-4 space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="size-3 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="size-9 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
