import type { Setup } from "./api";
import { getRigSetupStatus, type RigStatuses } from "./api";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days from `from` to `to` in the device's time zone, so a rig
 * at 23:50 is "1 day" old at 00:10. Negative when `to` is before `from`.
 */
export function calendarDaysBetween(from: Date, to: Date) {
  // Round to absorb the 23h/25h days around DST changes.
  return Math.round(
    (startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) /
      MS_PER_DAY,
  );
}

export type RigSetupDays = {
  status: RigStatuses;
  /**
   * rigged: days since rig day (0 on the rig day)
   * unrigged: days the line stayed up
   * planned: days until rig day (0 when it is today), or days since it when
   * `overdue`
   */
  days: number;
  /** A planned setup whose rig day has passed without being marked rigged. */
  overdue: boolean;
};

export function getRigSetupDays(
  setup: Pick<Setup[number], "is_rigged" | "unrigged_at" | "rig_date">,
  now: Date = new Date(),
): RigSetupDays {
  const status = getRigSetupStatus(setup);
  const rigDate = new Date(setup.rig_date);

  switch (status) {
    case "rigged":
      return {
        status,
        days: Math.max(0, calendarDaysBetween(rigDate, now)),
        overdue: false,
      };
    case "unrigged":
      return {
        status,
        days: Math.max(
          0,
          calendarDaysBetween(rigDate, new Date(setup.unrigged_at!)),
        ),
        overdue: false,
      };
    case "planned": {
      const daysUntil = calendarDaysBetween(now, rigDate);
      return { status, days: Math.abs(daysUntil), overdue: daysUntil < 0 };
    }
  }
}
