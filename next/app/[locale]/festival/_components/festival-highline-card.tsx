"use client";

import {
  formatFestivalQueueEstimateTime,
  getFestivalQueueEntryEstimate,
  useAddFestivalQueueManualEntry,
  type FestivalHighlineQueueCard,
  FestivalQueueActions,
  FestivalQueueJoinForm,
  FestivalQueuePanelShell,
  FestivalQueuePreviewList,
  FestivalQueueSummaryBadge,
  useCallNextFestivalQueue,
  useJoinFestivalQueue,
  useLeaveFestivalQueue,
  useRemoveFestivalQueueEntry,
} from "@chooselife/ui";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { UnfoldHorizontalIcon, UnfoldVerticalIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FavoriteHighline } from "@/components/FavoriteHighline";
import HighlineImage from "@/components/HighlineImage";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

interface Props {
  card: FestivalHighlineQueueCard;
  festivalSlug: string;
  viewerCanManage: boolean;
  viewerDefaultName?: string | null;
  viewerUserId?: string;
}

export function FestivalHighlineCard({
  card,
  festivalSlug,
  viewerCanManage,
  viewerDefaultName,
  viewerUserId,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("festival.queue");
  const homeT = useTranslations("home");
  const [queueName, setQueueName] = useState(viewerDefaultName ?? "");
  const [manualQueueName, setManualQueueName] = useState("");
  const isAuthenticated = !!viewerUserId;

  const joinMutation = useJoinFestivalQueue({
    festivalSlug,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("messages.joinSuccess"));
        setQueueName(viewerDefaultName ?? "");
        return;
      }

      toast.error(result.error ?? t("messages.joinError"));
    },
  });

  const manualJoinMutation = useAddFestivalQueueManualEntry({
    festivalSlug,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("messages.manualAddSuccess"));
        setManualQueueName("");
        return;
      }

      toast.error(result.error ?? t("messages.manualAddError"));
    },
  });

  const leaveMutation = useLeaveFestivalQueue({
    festivalSlug,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("messages.leaveSuccess"));
        return;
      }

      toast.error(result.error ?? t("messages.leaveError"));
    },
  });

  const callNextMutation = useCallNextFestivalQueue({
    festivalSlug,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("messages.callNextSuccess"));
        return;
      }

      toast.error(result.error ?? t("messages.callNextError"));
    },
  });

  const removeMutation = useRemoveFestivalQueueEntry({
    festivalSlug,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t("messages.removeSuccess"));
        return;
      }

      toast.error(result.error ?? t("messages.removeError"));
    },
  });

  const previewEntries = useMemo(() => {
    const entries = card.queueSummary.calledEntry
      ? [card.queueSummary.calledEntry, ...card.queueSummary.nextEntries]
      : card.queueSummary.nextEntries;
    return entries.slice(0, 4);
  }, [card.queueSummary.calledEntry, card.queueSummary.nextEntries]);

  const estimateLabelByEntryId = useMemo(
    () =>
      Object.fromEntries(
        card.queueSummary.activeEntries.map((entry) => {
          const estimate = getFestivalQueueEntryEstimate({
            entry,
            entries: card.queueSummary.activeEntries,
          });

          if (!estimate) {
            return [entry.id, undefined];
          }

          const label =
            estimate.minutesUntilTurn === 0
              ? t("estimateNow")
              : t("estimateAt", {
                  time: formatFestivalQueueEstimateTime({
                    date: estimate.estimatedStartAt,
                    locale,
                  }),
                });

          return [entry.id, label];
        }),
      ),
    [card.queueSummary.activeEntries, locale, t],
  );
  const viewerEstimateLabel = card.queueSummary.viewerEntry
    ? estimateLabelByEntryId[card.queueSummary.viewerEntry.id]
    : undefined;

  return (
    <Card className="flex w-full max-w-[22rem] flex-col overflow-hidden">
      <div className="relative h-48 w-full">
        <HighlineImage coverImageId={card.highline.cover_image} />
        <FavoriteHighline
          id={card.highline.id}
          isFavorite={card.highline.is_favorite}
        />
      </div>
      <CardHeader className="space-y-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-xl">{card.highline.name}</CardTitle>
          <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <UnfoldVerticalIcon className="h-4 w-4" />
              {card.highline.height.toFixed(0)}m
            </div>
            <div className="flex gap-2">
              <UnfoldHorizontalIcon className="h-4 w-4" />
              {card.highline.length.toFixed(0)}m
            </div>
          </div>
        </div>

        <FestivalQueueSummaryBadge
          currentLabel={t("current")}
          currentName={card.queueSummary.calledEntry?.display_name}
          waitingCount={card.queueSummary.waitingCount}
          waitingLabel={t("waitingCountLabel")}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {card.highline.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {card.highline.description}
          </p>
        ) : null}

        <FestivalQueuePreviewList
          emptyLabel={t("empty")}
          entries={previewEntries}
          metaLabelByEntryId={estimateLabelByEntryId}
          title={t("previewTitle")}
        />

        {card.queueSummary.viewerPosition ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            <p>{t("viewerPosition", { position: card.queueSummary.viewerPosition })}</p>
            {viewerEstimateLabel ? (
              <p className="text-xs text-primary/80">{viewerEstimateLabel}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto grid gap-3">
        <Button variant="outline" className="w-full" asChild>
          <Link href={`/highline/${card.highline.id}`}>
            {homeT("seeDetails")}
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </Button>

        <Drawer>
          <DrawerTrigger asChild>
            <Button className="w-full">{t("openQueue")}</Button>
          </DrawerTrigger>
          <DrawerContent className="mx-auto w-full max-w-xl">
            <DrawerHeader>
              <DrawerTitle>{card.highline.name}</DrawerTitle>
              <DrawerDescription>
                {card.sector?.name
                  ? t("drawerDescription", { sector: card.sector.name })
                  : t("drawerDescriptionNoSector")}
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-6 overflow-y-auto px-4 pb-6">
              <FestivalQueuePanelShell
                badge={viewerCanManage ? t("monitorBadge") : undefined}
                description={t("panelDescription")}
                title={t("panelTitle")}
              >
                <FestivalQueueSummaryBadge
                  currentLabel={t("current")}
                  currentName={card.queueSummary.calledEntry?.display_name}
                  waitingCount={card.queueSummary.waitingCount}
                  waitingLabel={t("waitingCountLabel")}
                />

                <FestivalQueuePreviewList
                  emptyLabel={t("empty")}
                  entries={card.queueSummary.activeEntries}
                  metaLabelByEntryId={estimateLabelByEntryId}
                  title={t("lineupTitle")}
                />
              </FestivalQueuePanelShell>

              {!isAuthenticated ? (
                <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  {t("authRequired")}
                </div>
              ) : null}

              {isAuthenticated && !card.queueSummary.viewerEntry ? (
                <FestivalQueueJoinForm
                  buttonLabel={t("joinButton")}
                  helperLabel={t("joinHelper")}
                  inputPlaceholder={t("namePlaceholder")}
                  isSubmitting={joinMutation.isPending}
                  onChange={setQueueName}
                  onSubmit={() => {
                    joinMutation.mutate({
                      festivalSlug,
                      highlineId: card.highline.id,
                      displayName: queueName,
                    });
                  }}
                  value={queueName}
                />
              ) : null}

              {viewerCanManage ? (
                <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-medium">{t("manualJoinTitle")}</p>
                  <FestivalQueueJoinForm
                    buttonLabel={t("manualJoinButton")}
                    helperLabel={t("manualJoinHelper")}
                    inputPlaceholder={t("manualNamePlaceholder")}
                    isSubmitting={manualJoinMutation.isPending}
                    onChange={setManualQueueName}
                    onSubmit={() => {
                      manualJoinMutation.mutate({
                        festivalSlug,
                        highlineId: card.highline.id,
                        displayName: manualQueueName,
                      });
                    }}
                    value={manualQueueName}
                  />
                </div>
              ) : null}

              <FestivalQueueActions
                callNextLabel={t("callNext")}
                canLeave={!!card.queueSummary.viewerEntry}
                canManage={viewerCanManage}
                isCallingNext={callNextMutation.isPending}
                isLeaving={leaveMutation.isPending}
                leaveLabel={t("leaveButton")}
                onCallNext={() => {
                  callNextMutation.mutate({
                    festivalSlug,
                    highlineId: card.highline.id,
                  });
                }}
                onLeave={() => {
                  if (!card.queueSummary.viewerEntry) return;
                  leaveMutation.mutate({ entryId: card.queueSummary.viewerEntry.id });
                }}
              />

              {viewerCanManage && card.queueSummary.activeEntries.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">{t("manageTitle")}</p>
                  <div className="space-y-2">
                    {card.queueSummary.activeEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate">
                            {entry.queuePosition}. {entry.display_name}
                          </p>
                          {estimateLabelByEntryId[entry.id] ? (
                            <p className="text-xs text-muted-foreground">
                              {estimateLabelByEntryId[entry.id]}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => removeMutation.mutate({ entryId: entry.id })}
                        >
                          {t("removeButton")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </DrawerContent>
        </Drawer>
      </CardFooter>
    </Card>
  );
}
