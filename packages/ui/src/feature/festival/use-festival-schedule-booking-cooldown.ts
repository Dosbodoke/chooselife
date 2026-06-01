"use client";

import { useSyncExternalStore } from "react";

const secondTickSubscribers = new Set<() => void>();
let currentTime = Date.now();
let secondTickInterval: ReturnType<typeof setInterval> | undefined;

function subscribeToSecondTick(onStoreChange: () => void) {
  secondTickSubscribers.add(onStoreChange);

  if (!secondTickInterval) {
    currentTime = Date.now();
    secondTickInterval = setInterval(() => {
      currentTime = Date.now();
      secondTickSubscribers.forEach((subscriber) => subscriber());
    }, 1_000);
  }

  return () => {
    secondTickSubscribers.delete(onStoreChange);

    if (secondTickSubscribers.size === 0 && secondTickInterval) {
      clearInterval(secondTickInterval);
      secondTickInterval = undefined;
    }
  };
}

function getCurrentTime() {
  return currentTime;
}

export function getFestivalScheduleBookingCooldownRemainingSeconds(
  cooldownEndsAt: string | null | undefined,
  now = Date.now(),
) {
  if (!cooldownEndsAt) return 0;

  return Math.max(
    0,
    Math.ceil((new Date(cooldownEndsAt).getTime() - now) / 1_000),
  );
}

export function formatFestivalScheduleBookingCooldown(
  remainingSeconds: number,
) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useFestivalScheduleBookingCooldown(
  cooldownEndsAt: string | null | undefined,
) {
  const now = useSyncExternalStore(
    subscribeToSecondTick,
    getCurrentTime,
    getCurrentTime,
  );
  const remainingSeconds =
    getFestivalScheduleBookingCooldownRemainingSeconds(cooldownEndsAt, now);

  return {
    label: formatFestivalScheduleBookingCooldown(remainingSeconds),
    remainingSeconds,
  };
}
