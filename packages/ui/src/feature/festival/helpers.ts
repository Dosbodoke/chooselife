import type {
  FestivalHighlineScheduleCard,
  FestivalScheduleSlotView,
  FestivalScheduleSectorGroup,
} from "./types";

export type ViewerFestivalBooking = {
  card: FestivalHighlineScheduleCard;
  dayKey: string;
  slot: FestivalScheduleSlotView;
};

export function buildFestivalScheduleRedirect({
  dayKey,
  highlineId,
}: {
  dayKey: string | null;
  highlineId: string;
}) {
  const params = new URLSearchParams({ highline: highlineId });

  if (dayKey) {
    params.set("day", dayKey);
  }

  return `/festival?${params.toString()}`;
}

export function formatBookingOpensAt(
  dateTime: string,
  locale: string,
  timeZone: string,
) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(dateTime));
}

export function getSectorKey(group: FestivalScheduleSectorGroup) {
  if (group.sector?.id) {
    return group.sector.id;
  }

  return "festival";
}

export function getSectorName(
  group: FestivalScheduleSectorGroup,
  fallbackLabel: string,
) {
  if (group.sector?.name) {
    return group.sector.name;
  }

  return fallbackLabel;
}

export function getViewerFestivalBookings(
  sectors: FestivalScheduleSectorGroup[],
): ViewerFestivalBooking[] {
  return sectors
    .flatMap((group) =>
      group.cards.flatMap((card) =>
        card.days.flatMap((day) =>
          day.slots
            .filter((slot) => slot.state === "booked" && slot.booking?.isViewer)
            .map((slot) => ({
              card,
              dayKey: day.dateKey,
              slot,
            })),
        ),
      ),
    )
    .sort(
      (a, b) =>
        new Date(a.slot.startAt).getTime() - new Date(b.slot.startAt).getTime(),
    );
}

export function formatBookingDayLabel(
  dateKey: string,
  locale: string,
  timeZone: string,
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}
