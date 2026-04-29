import type { FestivalQueueEntry } from "./types";

export const FESTIVAL_QUEUE_SLOT_MINUTES = 30;

export interface FestivalQueueEntryEstimate {
  estimatedStartAt: Date;
  minutesUntilTurn: number;
  slotMinutes: number;
}

export function getFestivalQueuePositionEstimate(args: {
  queuePosition: number;
  currentCalledAt?: string | null;
  referenceTime?: Date;
  slotMinutes?: number;
}): FestivalQueueEntryEstimate {
  const slotMinutes = args.slotMinutes ?? FESTIVAL_QUEUE_SLOT_MINUTES;
  const normalizedPosition = Math.max(args.queuePosition, 1);
  const referenceTime = args.referenceTime ?? new Date();
  const slotMs = slotMinutes * 60 * 1000;
  const hasActiveCalledSlot = !!args.currentCalledAt;

  let waitMs = 0;

  if (!hasActiveCalledSlot) {
    waitMs = Math.max(normalizedPosition - 1, 0) * slotMs;
  } else if (normalizedPosition > 1) {
    const currentCalledAt = args.currentCalledAt as string;
    const calledAtMs = new Date(currentCalledAt).getTime();
    const elapsedMs = Math.max(referenceTime.getTime() - calledAtMs, 0);
    const remainingCurrentSlotMs = Math.max(slotMs - elapsedMs, 0);

    waitMs = remainingCurrentSlotMs + Math.max(normalizedPosition - 2, 0) * slotMs;
  }

  const minutesUntilTurn = Math.ceil(waitMs / (60 * 1000));

  return {
    estimatedStartAt: new Date(referenceTime.getTime() + waitMs),
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

  const calledEntry =
    args.entries.find((candidate) => candidate.status === "called") ?? null;

  return getFestivalQueuePositionEstimate({
    queuePosition: queueIndex + 1,
    currentCalledAt: calledEntry?.called_at ?? null,
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

export function getElapsedMinutes(startedAt: string | null | undefined, now: Date): number | null {
  if (!startedAt) return null;

  const startedAtDate = new Date(startedAt);

  if (Number.isNaN(startedAtDate.getTime())) {
    return null;
  }

  const elapsedMs = now.getTime() - startedAtDate.getTime();

  return Math.max(0, Math.floor(elapsedMs / 60_000));
};

export function formatElapsedTime(minutes: number): string {
  if (minutes < 1) {
    return 'menos de 1 min';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
};
