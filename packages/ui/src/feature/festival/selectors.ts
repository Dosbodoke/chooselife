import type {
  FestivalFeaturedSlot,
  FestivalHighline,
  FestivalHighlineLink,
  FestivalHighlineScheduleCard,
  FestivalParticipantDisplay,
  FestivalScheduleBookingBlockedReason,
  FestivalScheduleBookingRecord,
  FestivalScheduleBookingView,
  FestivalScheduleDay,
  FestivalScheduleSectorGroup,
  FestivalScheduleSlotRecord,
  FestivalScheduleSlotState,
  FestivalScheduleSlotView,
  FestivalScheduleWindowRecord,
  FestivalSector,
  FestivalViewerState,
} from "./types";

type ViewerActiveBookingWindow = FestivalScheduleBookingRecord & {
  start_at: string;
  end_at: string;
};

type DayWindowMeta = {
  bookingOpensAt: string | null;
  latestWindowEndAt: string | null;
};

type DerivedFestivalScheduleDay = FestivalScheduleDay & {
  latestWindowEndAt: string | null;
};

function formatFestivalDayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function toBookingView(args: {
  booking: FestivalScheduleBookingRecord;
}): FestivalScheduleBookingView {
  const { booking } = args;
  return {
    id: booking.id,
    status: booking.status,
    participant: {
      primaryText: booking.participant_display_name,
      secondaryText: booking.participant_secondary_text,
    },
    isViewer: booking.is_viewer,
  };
}

function getViewerBookingBlockedReason(args: {
  isWindowOpen: boolean;
  now: Date;
  slot: FestivalScheduleSlotRecord;
  state: FestivalScheduleSlotState;
  viewerActiveBookings: ViewerActiveBookingWindow[];
  viewerId?: string;
}): FestivalScheduleBookingBlockedReason | null {
  const { isWindowOpen, now, slot, state, viewerActiveBookings, viewerId } = args;

  if (state !== "available") return null;
  if (new Date(slot.end_at).getTime() <= now.getTime()) return null;

  if (!isWindowOpen) {
    return "window_not_open";
  }

  if (!viewerId) {
    return null;
  }

  if (viewerActiveBookings.length >= 2) {
    return "limit";
  }

  if (
    viewerActiveBookings.some((booking) => {
      if (booking.slot_id === slot.id) return false;

      return (
        new Date(booking.start_at).getTime() < new Date(slot.end_at).getTime()
        && new Date(booking.end_at).getTime() > new Date(slot.start_at).getTime()
      );
    })
  ) {
    return "overlap";
  }

  return null;
}

function buildSlotView(args: {
  slot: FestivalScheduleSlotRecord;
  activeBooking: FestivalScheduleBookingRecord | null;
  completedBooking: FestivalScheduleBookingRecord | null;
  now: Date;
  isWindowOpen: boolean;
  viewerActiveBookings: ViewerActiveBookingWindow[];
  viewerId?: string;
}): FestivalScheduleSlotView {
  const {
    slot,
    activeBooking,
    completedBooking,
    now,
    isWindowOpen,
    viewerActiveBookings,
    viewerId,
  } = args;

  let state: FestivalScheduleSlotState;
  let booking: FestivalScheduleBookingView | null = null;
  const slotEnded = new Date(slot.end_at).getTime() <= now.getTime();

  if (activeBooking) {
    if (slot.status === "blocked") {
      state = "blocked";
    } else if (slotEnded) {
      state = "completed";
      booking = toBookingView({ booking: activeBooking });
    } else {
      state = "booked";
      booking = toBookingView({ booking: activeBooking });
    }
  } else if (completedBooking) {
    state = "completed";
    booking = toBookingView({ booking: completedBooking });
  } else if (slot.status === "blocked") {
    state = "blocked";
  } else if (slot.status === "expired" || slotEnded) {
    state = "expired";
  } else {
    state = "available";
  }

  const isClaimable =
    state === "available"
    && !slotEnded
    && isWindowOpen;
  const bookingBlockedReason = getViewerBookingBlockedReason({
    isWindowOpen,
    now,
    slot,
    state,
    viewerActiveBookings,
    viewerId,
  });

  return {
    id: slot.id,
    highlineId: slot.highline_id,
    startAt: slot.start_at,
    endAt: slot.end_at,
    state,
    blockReason: slot.block_reason,
    booking,
    isCurrent:
      state === "booked"
      && new Date(slot.start_at).getTime() <= now.getTime()
      && new Date(slot.end_at).getTime() > now.getTime(),
    isClaimable,
    bookingBlockedReason,
  };
}

function pickFeaturedSlot(
  slots: FestivalScheduleSlotView[],
  now: Date,
): FestivalFeaturedSlot | null {
  const current = slots.find((slot) => slot.isCurrent) ?? null;
  if (current) return current;

  return (
    slots.find(
      (slot) =>
        slot.state === "booked" && new Date(slot.endAt).getTime() > now.getTime(),
    ) ?? null
  );
}

function pickDefaultDay(args: {
  days: DerivedFestivalScheduleDay[];
  currentDayKey: string;
  now: Date;
}): DerivedFestivalScheduleDay | null {
  const { days, currentDayKey, now } = args;
  if (days.length === 0) return null;

  const today = days.find((day) => day.dateKey === currentDayKey) ?? null;
  if (today) {
    const dayCloseAt = today.latestWindowEndAt
      ? new Date(today.latestWindowEndAt).getTime()
      : null;

    if (dayCloseAt === null || now.getTime() < dayCloseAt) {
      return today;
    }

    const nextFutureDay = days.find((day) => day.dateKey > currentDayKey) ?? null;
    if (nextFutureDay) {
      return nextFutureDay;
    }
  }

  const upcoming = days.find((day) => day.dateKey > currentDayKey) ?? null;
  if (upcoming) return upcoming;

  return days[days.length - 1] ?? null;
}

export function buildFestivalScheduleCards(args: {
  highlines: FestivalHighline[];
  links: FestivalHighlineLink[];
  sectors: Pick<FestivalSector, "id" | "name" | "description">[];
  windows: FestivalScheduleWindowRecord[];
  slots: FestivalScheduleSlotRecord[];
  bookings: FestivalScheduleBookingRecord[];
  timeZone: string;
  viewer: FestivalViewerState;
  referenceTime?: Date;
}): FestivalHighlineScheduleCard[] {
  const now = args.referenceTime ?? new Date();
  const currentDayKey = formatFestivalDayKey(now, args.timeZone);
  const highlineById = new Map(args.highlines.map((highline) => [highline.id, highline]));
  const sectorById = new Map(args.sectors.map((sector) => [sector.id, sector]));
  const slotsByHighline = new Map<string, FestivalScheduleSlotRecord[]>();
  const bookingsBySlot = new Map<string, FestivalScheduleBookingRecord[]>();
  const slotById = new Map(args.slots.map((slot) => [slot.id, slot]));
  const windowById = new Map(args.windows.map((window) => [window.id, window]));

  for (const slot of args.slots) {
    const entries = slotsByHighline.get(slot.highline_id) ?? [];
    entries.push(slot);
    slotsByHighline.set(slot.highline_id, entries);
  }

  for (const booking of args.bookings) {
    const entries = bookingsBySlot.get(booking.slot_id) ?? [];
    entries.push(booking);
    bookingsBySlot.set(booking.slot_id, entries);
  }

  const viewerActiveBookings: ViewerActiveBookingWindow[] = args.viewer.userId
    ? args.bookings
      .filter(
          (booking) =>
            booking.status === "booked" && booking.is_viewer,
        )
        .map((booking) => {
          const slot = slotById.get(booking.slot_id);
          return slot
            ? {
                ...booking,
                start_at: slot.start_at,
                end_at: slot.end_at,
              }
            : null;
        })
        .filter(
          (
            booking,
          ): booking is ViewerActiveBookingWindow => booking !== null,
        )
    : [];

  return args.links
    .map((link) => {
      const highline = highlineById.get(link.highlineId);
      if (!highline) return null;

      const rawSlots = (slotsByHighline.get(highline.id) ?? []).sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );

      const dayMap = new Map<string, FestivalScheduleSlotView[]>();
      const dayMetaByKey = new Map<string, DayWindowMeta>();

      for (const slot of rawSlots) {
        const scheduleWindow = windowById.get(slot.window_id);
        if (!scheduleWindow) continue;

        const slotBookings = (bookingsBySlot.get(slot.id) ?? []).sort((a, b) => {
          const aTime = new Date(a.completed_at ?? a.created_at).getTime();
          const bTime = new Date(b.completed_at ?? b.created_at).getTime();
          return bTime - aTime;
        });

        const activeBooking =
          slotBookings.find((booking) => booking.status === "booked") ?? null;
        const completedBooking =
          slotBookings.find((booking) => booking.status === "completed") ?? null;
        const dayKey = formatFestivalDayKey(new Date(slot.start_at), args.timeZone);
        const isWindowOpen =
          new Date(scheduleWindow.scheduling_opens_at).getTime() <= now.getTime();
        const view = buildSlotView({
          slot,
          activeBooking,
          completedBooking,
          now,
          isWindowOpen,
          viewerActiveBookings,
          viewerId: args.viewer.userId,
        });
        const entries = dayMap.get(dayKey) ?? [];
        entries.push(view);
        dayMap.set(dayKey, entries);

        const existingMeta = dayMetaByKey.get(dayKey);
        if (!existingMeta) {
          dayMetaByKey.set(dayKey, {
            bookingOpensAt: scheduleWindow.scheduling_opens_at,
            latestWindowEndAt: scheduleWindow.window_end_at,
          });
          continue;
        }

        const nextBookingOpensAt =
          existingMeta.bookingOpensAt === null
            ? scheduleWindow.scheduling_opens_at
            : existingMeta.bookingOpensAt;
        const nextLatestWindowEndAt =
          existingMeta.latestWindowEndAt === null
          || new Date(scheduleWindow.window_end_at).getTime()
            > new Date(existingMeta.latestWindowEndAt).getTime()
            ? scheduleWindow.window_end_at
            : existingMeta.latestWindowEndAt;

        dayMetaByKey.set(dayKey, {
          bookingOpensAt: nextBookingOpensAt,
          latestWindowEndAt: nextLatestWindowEndAt,
        });
      }

      const derivedDays: DerivedFestivalScheduleDay[] = Array.from(dayMap.entries())
        .map(([dateKey, slots]) => {
          const orderedSlots = slots.sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          );
          const dayMeta = dayMetaByKey.get(dateKey);
          const bookingOpensAt = dayMeta?.bookingOpensAt ?? null;
          const latestWindowEndAt = dayMeta?.latestWindowEndAt ?? null;
          const isBookingOpen =
            bookingOpensAt === null
            || new Date(bookingOpensAt).getTime() <= now.getTime();

          return {
            dateKey,
            slots: orderedSlots,
            availableCount: orderedSlots.filter((slot) => slot.isClaimable).length,
            preOpenAvailableCount: orderedSlots.filter(
              (slot) =>
                slot.state === "available"
                && new Date(slot.endAt).getTime() > now.getTime()
                && slot.bookingBlockedReason === "window_not_open",
            ).length,
            bookingOpensAt,
            isBookingOpen,
            featuredSlot: pickFeaturedSlot(orderedSlots, now),
            isCurrentDay: dateKey === currentDayKey,
            latestWindowEndAt,
          };
        })
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      const defaultDay = pickDefaultDay({
        days: derivedDays,
        currentDayKey,
        now,
      });
      const sector = highline.sector_id
        ? sectorById.get(highline.sector_id) ?? null
        : null;
      const days: FestivalScheduleDay[] = derivedDays.map(
        ({ latestWindowEndAt: _latestWindowEndAt, ...day }) => day,
      );

      return {
        highline,
        sector,
        sortOrder: link.sortOrder,
        days,
        dayKeys: days.map((day) => day.dateKey),
        defaultDayKey: defaultDay?.dateKey ?? null,
        defaultDay: defaultDay
          ? (({ latestWindowEndAt: _latestWindowEndAt, ...day }) => day)(defaultDay)
          : null,
        availableCount: defaultDay?.availableCount ?? 0,
        preOpenAvailableCount: defaultDay?.preOpenAvailableCount ?? 0,
        bookingOpensAt: defaultDay?.bookingOpensAt ?? null,
        isBookingOpen: defaultDay?.isBookingOpen ?? false,
        featuredSlot: defaultDay?.featuredSlot ?? null,
      } satisfies FestivalHighlineScheduleCard;
    })
    .filter((card): card is FestivalHighlineScheduleCard => card !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function groupFestivalCardsBySector(
  cards: FestivalHighlineScheduleCard[],
): FestivalScheduleSectorGroup[] {
  const groups = new Map<string, FestivalScheduleSectorGroup>();

  for (const card of cards) {
    const groupKey = card.sector ? `sector:${card.sector.id}` : "sector:none";
    const existing = groups.get(groupKey);
    if (existing) {
      existing.cards.push(card);
      continue;
    }

    groups.set(groupKey, {
      sector: card.sector,
      cards: [card],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    cards: group.cards.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export { formatFestivalDayKey };
