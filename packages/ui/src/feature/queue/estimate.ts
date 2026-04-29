import type { FestivalQueueEntry } from "./types";

export const FESTIVAL_QUEUE_SLOT_MINUTES = 30;

export interface FestivalQueueEntryEstimate {
  estimatedStartAt: Date;
  minutesUntilTurn: number;
  slotMinutes: number;
}

export function getFestivalQueuePositionEstimate(args: {
  queuePosition: number;
  referenceTime?: Date;
  slotMinutes?: number;
}): FestivalQueueEntryEstimate {
  const slotMinutes = args.slotMinutes ?? FESTIVAL_QUEUE_SLOT_MINUTES;
  const normalizedPosition = Math.max(args.queuePosition, 1);
  const minutesUntilTurn = (normalizedPosition - 1) * slotMinutes;
  const referenceTime = args.referenceTime ?? new Date();

  return {
    estimatedStartAt: new Date(
      referenceTime.getTime() + minutesUntilTurn * 60 * 1000,
    ),
    minutesUntilTurn,
    slotMinutes,
  };
}

export function getFestivalQueueEntryEstimate(args: {
  entry: FestivalQueueEntry;
  entries: FestivalQueueEntry[];
  referenceTime?: Date;
  slotMinutes?: number;
}): FestivalQueueEntryEstimate | null {
  const slotMinutes = args.slotMinutes ?? FESTIVAL_QUEUE_SLOT_MINUTES;
  const queueIndex = args.entries.findIndex(
    (candidate) => candidate.id === args.entry.id,
  );

  if (queueIndex === -1) {
    return null;
  }

  return getFestivalQueuePositionEstimate({
    queuePosition: queueIndex + 1,
    referenceTime: args.referenceTime,
    slotMinutes,
  });
}

export function formatFestivalQueueEstimateTime(args: {
  date: Date;
  locale?: string;
}) {
  return new Intl.DateTimeFormat(args.locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(args.date);
}
