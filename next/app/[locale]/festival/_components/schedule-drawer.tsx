"use client";

import {
  useBookFestivalScheduleSlot,
  useCancelFestivalScheduleBooking,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSlotView,
} from "@chooselife/ui";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { UserPicker } from "@/components/user-picker";

function formatDayLabel(dateKey: string, locale: string, timeZone: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(date);
}

function formatSlotTimeRange(
  slot: FestivalScheduleSlotView,
  locale: string,
  timeZone: string
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt)
  )}`;
}

function SlotRow({
  canManage,
  festivalTimeZone,
  isAuthenticated,
  locale,
  onCancelBooking,
  onSelfBook,
  onStaffBook,
  slot,
}: {
  canManage: boolean;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  locale: string;
  onCancelBooking: (slot: FestivalScheduleSlotView) => void;
  onSelfBook: (slotId: string) => void;
  onStaffBook: (slotId: string) => void;
  slot: FestivalScheduleSlotView;
}) {
  const t = useTranslations("festival.schedule");
  const isPastSlot =
    !slot.isCurrent && new Date(slot.endAt).getTime() <= Date.now();
  const title = slot.booking?.participant.primaryText ?? null;
  const subtitle =
    slot.state === "blocked"
      ? slot.blockReason
      : slot.booking?.participant.secondaryText ?? null;
  const disabledSelfBookingLabel =
    slot.selfBookingBlockedReason === "overlap"
      ? t("claimSlotBlockedOverlap")
      : slot.selfBookingBlockedReason === "limit"
      ? t("claimSlotBlockedLimit")
      : null;
  const isFreeSlot = slot.state === "available";

  return (
    <div
      className={[
        "space-y-3 rounded-2xl border px-4 py-4",
        slot.isCurrent
          ? "border-emerald-200 bg-emerald-50"
          : isPastSlot
          ? "border-dashed border-slate-300 bg-slate-50"
          : isFreeSlot
          ? "border-emerald-300 bg-emerald-50/50"
          : slot.state === "blocked"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p
            className={[
              "text-sm font-semibold uppercase tracking-[1px]",
              isPastSlot ? "text-slate-400" : "text-slate-500",
            ].join(" ")}
          >
            {formatSlotTimeRange(slot, locale, festivalTimeZone)}
          </p>
          {title ? (
            <p
              className={[
                "text-base font-semibold",
                isPastSlot ? "text-slate-500" : "text-slate-900",
              ].join(" ")}
            >
              {title}
            </p>
          ) : null}
          {subtitle ? (
            <p
              className={[
                "text-sm",
                isPastSlot ? "text-slate-400" : "text-slate-500",
              ].join(" ")}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={[
            "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.8px]",
            isPastSlot
              ? "bg-slate-200 text-slate-400"
              : isFreeSlot
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500",
          ].join(" ")}
        >
          {slot.isCurrent
            ? t("current")
            : slot.state === "available"
            ? t("availableState")
            : slot.state === "booked"
            ? t("bookedState")
            : slot.state === "completed"
            ? t("completedLabel")
            : slot.state === "blocked"
            ? t("blockedTitle")
            : t("expiredLabel")}
        </div>
      </div>

      {slot.state === "available" && isAuthenticated ? (
        <div className="flex flex-wrap gap-2">
          {slot.canSelfBook ? (
            <Button
              type="button"
              className="rounded-xl bg-[#101b2b] text-white hover:bg-[#101b2b]/95"
              onClick={() => onSelfBook(slot.id)}
            >
              {t("claimSlotButton")}
            </Button>
          ) : disabledSelfBookingLabel ? (
            <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 text-center">
              {disabledSelfBookingLabel}
            </div>
          ) : null}

          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onStaffBook(slot.id)}
            >
              {t("bookForSomeoneButton")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {slot.booking &&
      (slot.booking.isViewer || canManage) &&
      slot.state === "booked" ? (
        <Button
          type="button"
          variant={slot.booking.isViewer ? "destructive" : "outline"}
          onClick={() => onCancelBooking(slot)}
        >
          {slot.booking.isViewer
            ? t("cancelOwnBookingButton")
            : t("cancelBookingButton")}
        </Button>
      ) : null}
    </div>
  );
}

export function FestivalScheduleDrawer({
  card,
  canManage,
  festivalSlug,
  festivalTimeZone,
  isAuthenticated,
  open,
  onOpenChange,
}: {
  card: FestivalHighlineScheduleCard | null;
  canManage: boolean;
  festivalSlug: string;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("festival.schedule");
  const dayChipScrollRef = React.useRef<HTMLDivElement>(null);
  const dayChipRefs = React.useRef<Record<string, HTMLButtonElement | null>>(
    {}
  );
  const bookMutation = useBookFestivalScheduleSlot({ festivalSlug });
  const cancelMutation = useCancelFestivalScheduleBooking({ festivalSlug });
  const [selectedDayKey, setSelectedDayKey] = React.useState<string | null>(
    null
  );
  const [staffSlotId, setStaffSlotId] = React.useState<string | null>(null);
  const [selectedUsernames, setSelectedUsernames] = React.useState<string[]>(
    []
  );
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [guestDisplayName, setGuestDisplayName] = React.useState("");

  React.useEffect(() => {
    setSelectedDayKey(card?.defaultDayKey ?? null);
    setStaffSlotId(null);
    setSelectedUsernames([]);
    setSelectedUserIds([]);
    setGuestDisplayName("");
  }, [card?.defaultDayKey, card?.highline.id]);

  const selectedDay =
    card?.days.find((day) => day.dateKey === selectedDayKey) ??
    card?.defaultDay ??
    null;

  const scrollSelectedDayChipIntoView = React.useCallback(
    (dayKey: string | null) => {
      if (!dayKey) return;

      const container = dayChipScrollRef.current;
      const chip = dayChipRefs.current[dayKey];
      if (!container || !chip) return;

      const nextLeft = Math.max(
        chip.offsetLeft - (container.clientWidth - chip.clientWidth) / 2,
        0
      );

      container.scrollTo({ left: nextLeft, behavior: "auto" });
    },
    []
  );

  React.useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      scrollSelectedDayChipIntoView(selectedDayKey);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open, scrollSelectedDayChipIntoView, selectedDayKey]);

  const resetStaffBooking = React.useCallback(() => {
    setStaffSlotId(null);
    setSelectedUsernames([]);
    setSelectedUserIds([]);
    setGuestDisplayName("");
  }, []);

  const showGenericError = React.useCallback(() => {
    toast.error(t("genericError"));
  }, [t]);

  const showLocalError = React.useCallback((message: string) => {
    toast.error(message);
  }, []);

  const handleSelfBook = React.useCallback(
    async (slotId: string) => {
      const result = await bookMutation.mutateAsync({ slotId });
      if (!result.success) {
        if (result.error === "festival_schedule_booking_overlap") {
          showLocalError(t("scheduleOverlapError"));
          return;
        }

        if (result.error === "festival_schedule_booking_limit") {
          showLocalError(t("scheduleLimitError"));
          return;
        }

        showGenericError();
      }
    },
    [bookMutation, showGenericError, showLocalError, t]
  );

  const handleCancelBooking = React.useCallback(
    async (slot: FestivalScheduleSlotView) => {
      if (!slot.booking) return;

      const result = await cancelMutation.mutateAsync({
        bookingId: slot.booking.id,
        reason: slot.booking.isViewer
          ? "Cancelled by user"
          : "Cancelled by staff",
      });

      if (!result.success) {
        showGenericError();
      }
    },
    [cancelMutation, showGenericError]
  );

  const handleConfirmStaffBooking = React.useCallback(async () => {
    if (!staffSlotId) return;

    const profileId = selectedUserIds[0] ?? null;
    const instagramUsername = profileId ? null : selectedUsernames[0] ?? null;

    if (!profileId && !instagramUsername) {
      showLocalError(t("missingStaffSelection"));
      return;
    }

    if (!profileId && !guestDisplayName.trim()) {
      showLocalError(t("missingGuestName"));
      return;
    }

    const result = await bookMutation.mutateAsync({
      slotId: staffSlotId,
      profileId,
      instagramUsername,
      displayName: profileId ? null : guestDisplayName.trim(),
    });

    if (!result.success) {
      showGenericError();
      return;
    }

    resetStaffBooking();
  }, [
    bookMutation,
    guestDisplayName,
    resetStaffBooking,
    selectedUserIds,
    selectedUsernames,
    staffSlotId,
    showGenericError,
    showLocalError,
    t,
  ]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[86vh] max-h-[86vh] w-full max-w-xl overflow-hidden rounded-t-[28px] border-slate-200 bg-white">
        <DrawerTitle className="sr-only">
          {card?.highline.name ?? t("scheduleTitle")}
        </DrawerTitle>

        {card ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 bg-white px-5 pb-4 pt-2">
              <div className="space-y-2">
                <div
                  ref={dayChipScrollRef}
                  className="-mx-5 relative overflow-x-auto pb-1"
                >
                  <div className="flex gap-2 px-5">
                    {card.days.map((day) => (
                      <button
                        key={day.dateKey}
                        ref={(element) => {
                          dayChipRefs.current[day.dateKey] = element;
                        }}
                        type="button"
                        className={[
                          "shrink-0 rounded-full px-3 py-2 text-sm font-semibold transition",
                          selectedDay?.dateKey === day.dateKey
                            ? "bg-[#101b2b] text-white"
                            : "bg-slate-100 text-slate-600",
                        ].join(" ")}
                        onClick={() => setSelectedDayKey(day.dateKey)}
                      >
                        {formatDayLabel(day.dateKey, locale, festivalTimeZone)}
                      </button>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
              <div className="space-y-4">
                {!isAuthenticated ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-sm leading-6 text-amber-950">
                      {t("authRequired")}
                    </p>
                  </div>
                ) : null}

                {selectedDay?.slots.length ? (
                  <div className="space-y-3">
                    {selectedDay.slots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        canManage={canManage}
                        festivalTimeZone={festivalTimeZone}
                        isAuthenticated={isAuthenticated}
                        locale={locale}
                        onCancelBooking={handleCancelBooking}
                        onSelfBook={handleSelfBook}
                        onStaffBook={setStaffSlotId}
                        slot={slot}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                    <p className="text-center text-sm text-slate-500">
                      {t("emptySchedule")}
                    </p>
                  </div>
                )}

                {canManage && staffSlotId ? (
                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {t("staffBookingTitle")}
                    </p>

                    <UserPicker
                      canPicknNonUser
                      maxSelection={1}
                      onValueChange={(usernames, userIds) => {
                        setSelectedUsernames(usernames);
                        setSelectedUserIds(userIds);
                      }}
                      placeholder={t("staffPickerPlaceholder")}
                    />

                    {selectedUserIds.length === 0 &&
                    selectedUsernames.length > 0 ? (
                      <Input
                        placeholder={t("guestNamePlaceholder")}
                        value={guestDisplayName}
                        onChange={(event) =>
                          setGuestDisplayName(event.target.value)
                        }
                      />
                    ) : null}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="bg-[#101b2b] text-white hover:bg-[#101b2b]/95"
                        onClick={handleConfirmStaffBooking}
                      >
                        {t("confirmStaffBookingButton")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetStaffBooking}
                      >
                        {t("cancelStaffBookingButton")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
