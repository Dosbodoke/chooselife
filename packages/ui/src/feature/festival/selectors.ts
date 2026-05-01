import type {
  FestivalFeaturedSlot,
  FestivalHighline,
  FestivalHighlineLink,
  FestivalHighlineScheduleCard,
  FestivalParticipantDisplay,
  FestivalProfile,
  FestivalScheduleBookingRecord,
  FestivalScheduleBookingView,
  FestivalScheduleDay,
  FestivalSchedulePageData,
  FestivalScheduleSectorGroup,
  FestivalScheduleSlotRecord,
  FestivalScheduleSlotState,
  FestivalScheduleSlotView,
  FestivalSector,
  FestivalViewerState,
} from "./types";

type ViewerActiveBookingWindow = FestivalScheduleBookingRecord & {
  start_at: string;
  end_at: string;
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

function formatParticipantDisplay(profile: FestivalProfile): FestivalParticipantDisplay {
  const username = profile.username?.trim();
  const displayName = profile.name?.trim();

  if (username && displayName) {
    return {
      primaryText: displayName,
      secondaryText: username,
    };
  }

  return {
    primaryText: displayName || username || "Unknown participant",
    secondaryText: displayName && !username ? null : undefined,
  };
}

function toBookingView(args: {
  booking: FestivalScheduleBookingRecord;
  profile: FestivalProfile | null;
  viewerId?: string;
}): FestivalScheduleBookingView {
  const { booking, profile, viewerId } = args;

  if (booking.profile_id && profile) {
    return {
      id: booking.id,
      profileId: booking.profile_id,
      status: booking.status,
      participant: formatParticipantDisplay(profile),
      isViewer: booking.profile_id === viewerId,
    };
  }

  return {
    id: booking.id,
    profileId: booking.profile_id,
    instagramUsername: booking.instagram_username,
    displayName: booking.display_name,
    status: booking.status,
    participant: {
      primaryText: booking.display_name ?? booking.instagram_username ?? "Guest",
      secondaryText: null,
    },
    isViewer: false,
  };
}

function buildSlotView(args: {
  slot: FestivalScheduleSlotRecord;
  activeBooking: FestivalScheduleBookingRecord | null;
  completedBooking: FestivalScheduleBookingRecord | null;
  profileById: Map<string, FestivalProfile>;
  now: Date;
  viewerActiveBookings: ViewerActiveBookingWindow[];
  viewerId?: string;
}): FestivalScheduleSlotView {
  const {
    slot,
    activeBooking,
    completedBooking,
    profileById,
    now,
    viewerActiveBookings,
    viewerId,
  } = args;

  let state: FestivalScheduleSlotState;
  let booking: FestivalScheduleBookingView | null = null;

  if (activeBooking) {
    state = "booked";
    booking = toBookingView({
      booking: activeBooking,
      profile: activeBooking.profile_id
        ? profileById.get(activeBooking.profile_id) ?? null
        : null,
      viewerId,
    });
  } else if (completedBooking) {
    state = "completed";
    booking = toBookingView({
      booking: completedBooking,
      profile: completedBooking.profile_id
        ? profileById.get(completedBooking.profile_id) ?? null
        : null,
      viewerId,
    });
  } else if (slot.status === "blocked") {
    state = "blocked";
  } else if (slot.status === "expired" || new Date(slot.end_at).getTime() <= now.getTime()) {
    state = "expired";
  } else {
    state = "available";
  }

  const isClaimable =
    state === "available" && new Date(slot.end_at).getTime() > now.getTime();
  let selfBookingBlockedReason: FestivalScheduleSlotView["selfBookingBlockedReason"] = null;

  if (isClaimable && viewerId) {
    if (viewerActiveBookings.length >= 2) {
      selfBookingBlockedReason = "limit";
    } else if (
      viewerActiveBookings.some((booking) => {
        if (booking.slot_id === slot.id) return false;

        return (
          new Date(booking.start_at).getTime() < new Date(slot.end_at).getTime()
          && new Date(booking.end_at).getTime() > new Date(slot.start_at).getTime()
        );
      })
    ) {
      selfBookingBlockedReason = "overlap";
    }
  }

  return {
    id: slot.id,
    highlineId: slot.highline_id,
    startAt: slot.start_at,
    endAt: slot.end_at,
    state,
    blockReason: slot.block_reason,
    booking,
    isCurrent:
      state === "booked" &&
      new Date(slot.start_at).getTime() <= now.getTime() &&
      new Date(slot.end_at).getTime() > now.getTime(),
    isClaimable,
    canSelfBook: isClaimable && !selfBookingBlockedReason,
    selfBookingBlockedReason,
  };
}

function pickFeaturedSlot(slots: FestivalScheduleSlotView[]): FestivalFeaturedSlot | null {
  const current = slots.find((slot) => slot.isCurrent) ?? null;
  if (current) return current;

  return (
    slots.find(
      (slot) =>
        slot.state === "booked" && new Date(slot.endAt).getTime() > Date.now(),
    ) ?? null
  );
}

function pickDefaultDay(args: {
  days: FestivalScheduleDay[];
  currentDayKey: string;
}): FestivalScheduleDay | null {
  const { days, currentDayKey } = args;
  if (days.length === 0) return null;

  const today = days.find((day) => day.dateKey === currentDayKey) ?? null;
  if (today) return today;

  const nowKey = currentDayKey;
  const upcoming = days.find((day) => day.dateKey > nowKey) ?? null;
  if (upcoming) return upcoming;

  return days[days.length - 1] ?? null;
}

export function buildFestivalScheduleCards(args: {
  highlines: FestivalHighline[];
  links: FestivalHighlineLink[];
  sectors: Pick<FestivalSector, "id" | "name" | "description">[];
  slots: FestivalScheduleSlotRecord[];
  bookings: FestivalScheduleBookingRecord[];
  profiles: FestivalProfile[];
  timeZone: string;
  viewer: FestivalViewerState;
  referenceTime?: Date;
}): FestivalHighlineScheduleCard[] {
  const now = args.referenceTime ?? new Date();
  const currentDayKey = formatFestivalDayKey(now, args.timeZone);
  const highlineById = new Map(args.highlines.map((highline) => [highline.id, highline]));
  const sectorById = new Map(args.sectors.map((sector) => [sector.id, sector]));
  const profileById = new Map(args.profiles.map((profile) => [profile.id, profile]));
  const slotsByHighline = new Map<string, FestivalScheduleSlotRecord[]>();
  const bookingsBySlot = new Map<string, FestivalScheduleBookingRecord[]>();
  const slotById = new Map(args.slots.map((slot) => [slot.id, slot]));

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
            booking.status === "booked" && booking.profile_id === args.viewer.userId,
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

      for (const slot of rawSlots) {
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
        const view = buildSlotView({
          slot,
          activeBooking,
          completedBooking,
          profileById,
          now,
          viewerActiveBookings,
          viewerId: args.viewer.userId,
        });
        const entries = dayMap.get(dayKey) ?? [];
        entries.push(view);
        dayMap.set(dayKey, entries);
      }

      const days = Array.from(dayMap.entries())
        .map(([dateKey, slots]): FestivalScheduleDay => {
          const orderedSlots = slots.sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          );

          return {
            dateKey,
            slots: orderedSlots,
            availableCount: orderedSlots.filter((slot) => slot.isClaimable).length,
            featuredSlot: pickFeaturedSlot(orderedSlots),
            isCurrentDay: dateKey === currentDayKey,
          };
        })
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

      const defaultDay = pickDefaultDay({ days, currentDayKey });
      const sector = highline.sector_id
        ? sectorById.get(highline.sector_id) ?? null
        : null;

      return {
        highline,
        sector,
        sortOrder: link.sortOrder,
        days,
        dayKeys: days.map((day) => day.dateKey),
        defaultDayKey: defaultDay?.dateKey ?? null,
        defaultDay,
        availableCount: defaultDay?.availableCount ?? 0,
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
