"use client";

import {
  formatElapsedTime,
  formatFestivalQueueEstimateTime,
  getElapsedMinutes,
  getFestivalQueuePositionEstimate,
  useJoinFestivalQueue,
  useLeaveFestivalQueue,
  useRemoveFestivalQueueEntry,
  type FestivalHighlineQueueCard,
  type FestivalQueueEntry,
} from "@chooselife/ui";
import { Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

function QueueEntryRow({
  canManage,
  currentCalledAt,
  entry,
  isViewer,
  onRemove,
}: {
  canManage: boolean;
  currentCalledAt?: string | null;
  entry: FestivalQueueEntry;
  isViewer: boolean;
  onRemove: (entryId: string) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("festival.queue");
  const [now, setNow] = React.useState(() => new Date());

  const isCurrentCalledEntry =
    entry.status === "called" && entry.queuePosition === 1 && !!currentCalledAt;

  React.useEffect(() => {
    if (!isCurrentCalledEntry) return;

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [isCurrentCalledEntry]);

  const estimate = React.useMemo(
    () =>
      getFestivalQueuePositionEstimate({
        currentCalledAt,
        queuePosition: entry.queuePosition,
      }),
    [currentCalledAt, entry.queuePosition]
  );

  const elapsedMinutes = React.useMemo(
    () => getElapsedMinutes(currentCalledAt, now),
    [currentCalledAt, now]
  );

  const estimateLabel = isCurrentCalledEntry
    ? t("elapsedWalkingTime", {
        time: formatElapsedTime(elapsedMinutes ?? 0),
      })
    : estimate.minutesUntilTurn === 0
    ? t("estimateNow")
    : t("estimateAt", {
        time: formatFestivalQueueEstimateTime({
          date: estimate.estimatedStartAt,
          locale,
        }),
      });

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border px-4 py-3",
        entry.status === "called"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900">
        <span className="text-sm font-bold text-white">
          {entry.queuePosition}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-base font-semibold text-slate-900">
            {entry.display_name}
          </p>

          {isViewer ? (
            <div className="shrink-0 rounded-full bg-slate-100 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.8px] text-slate-500">
                {t("youLabel")}
              </span>
            </div>
          ) : null}
        </div>

        {estimateLabel ? (
          <p
            className={[
              "text-xs",
              isCurrentCalledEntry ? "text-emerald-700" : "text-slate-400",
            ].join(" ")}
          >
            {estimateLabel}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <button
          type="button"
          aria-label={t("removeButton")}
          className="rounded-full bg-rose-50 p-2 text-rose-500 transition hover:bg-rose-100"
          onClick={() => onRemove(entry.id)}
        >
          <Trash2Icon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function FestivalQueueDrawer({
  card,
  canManage,
  festivalSlug,
  isAuthenticated,
  open,
  onOpenChange,
  queueDisplayName,
}: {
  card: FestivalHighlineQueueCard | null;
  canManage: boolean;
  festivalSlug: string;
  isAuthenticated: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueDisplayName: string;
}) {
  const t = useTranslations("festival.queue");

  const joinMutation = useJoinFestivalQueue({ festivalSlug });
  const leaveMutation = useLeaveFestivalQueue({ festivalSlug });
  const removeMutation = useRemoveFestivalQueueEntry({ festivalSlug });

  const activeEntries = card?.queueSummary.activeEntries ?? [];
  const currentCalledAt = card?.queueSummary.calledEntry?.called_at ?? null;
  const viewerEntry = card?.queueSummary.viewerEntry ?? null;

  const handleError = React.useCallback(
    (message?: string) => {
      toast.error(message ?? t("genericError"));
    },
    [t]
  );

  const handleJoin = React.useCallback(async () => {
    if (!card) return;

    if (!isAuthenticated) {
      handleError(t("authRequired"));
      return;
    }

    if (!queueDisplayName.trim()) {
      handleError(t("missingDisplayName"));
      return;
    }

    const result = await joinMutation.mutateAsync({
      festivalSlug,
      highlineId: card.highline.id,
      displayName: queueDisplayName.trim(),
    });

    if (!result.success) {
      handleError(result.error);
    }
  }, [
    card,
    festivalSlug,
    handleError,
    isAuthenticated,
    joinMutation,
    queueDisplayName,
    t,
  ]);

  const handleLeave = React.useCallback(async () => {
    if (!viewerEntry) return;

    const result = await leaveMutation.mutateAsync({
      entryId: viewerEntry.id,
    });

    if (!result.success) {
      handleError(result.error);
    }
  }, [handleError, leaveMutation, viewerEntry]);

  const handleRemove = React.useCallback(
    async (entryId: string) => {
      const result = await removeMutation.mutateAsync({ entryId });

      if (!result.success) {
        handleError(result.error);
      }
    },
    [handleError, removeMutation]
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[86vh] max-h-[86vh] w-full max-w-xl overflow-hidden rounded-t-[28px] border-slate-200 bg-white">
        <DrawerTitle className="sr-only">
          {card?.highline.name ?? t("lineupTitle")}
        </DrawerTitle>

        {card ? (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto px-5 pb-28 pt-2">
              <div className="space-y-3">
                {!isAuthenticated ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-sm leading-6 text-amber-950">
                      {t("authRequired")}
                    </p>
                  </div>
                ) : null}

                <h2 className="text-lg font-bold text-slate-900">
                  {t("lineupTitle")}
                </h2>

                {activeEntries.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                    <p className="text-center text-sm text-slate-500">
                      {t("empty")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeEntries.map((entry) => (
                      <QueueEntryRow
                        key={entry.id}
                        canManage={canManage}
                        currentCalledAt={currentCalledAt}
                        entry={entry}
                        isViewer={entry.id === viewerEntry?.id}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isAuthenticated ? (
              <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white px-5 pb-6 pt-4">
                <Button
                  type="button"
                  className={[
                    "h-12 w-full rounded-2xl font-semibold text-white",
                    viewerEntry ? "" : "bg-[#101b2b] hover:bg-[#101b2b]/95",
                  ].join(" ")}
                  disabled={joinMutation.isPending || leaveMutation.isPending}
                  variant={viewerEntry ? "destructive" : "default"}
                  onClick={viewerEntry ? handleLeave : handleJoin}
                >
                  {viewerEntry ? t("leaveButton") : t("joinButton")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
