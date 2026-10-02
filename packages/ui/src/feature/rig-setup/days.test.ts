/// <reference types="jest" />

import { calendarDaysBetween, getRigSetupDays } from "./days";

// Local wall-clock time; jest.config.js pins TZ to America/New_York.
const at = (year: number, month: number, day: number, hour = 12, min = 0) =>
  new Date(year, month - 1, day, hour, min);

// Supabase returns `timestamptz` columns as ISO strings.
const iso = (date: Date) => date.toISOString();

const rigged = (rigDate: Date) => ({
  is_rigged: true,
  unrigged_at: null,
  rig_date: iso(rigDate),
});
const unrigged = (rigDate: Date, unriggedAt: Date) => ({
  is_rigged: false,
  unrigged_at: iso(unriggedAt),
  rig_date: iso(rigDate),
});
const planned = (rigDate: Date) => ({
  is_rigged: false,
  unrigged_at: null,
  rig_date: iso(rigDate),
});

describe("calendarDaysBetween", () => {
  it("is 0 within the same calendar day", () => {
    expect(
      calendarDaysBetween(at(2026, 10, 2, 0, 1), at(2026, 10, 2, 23, 59)),
    ).toBe(0);
  });

  it("counts calendar days, not 24h periods", () => {
    expect(
      calendarDaysBetween(at(2026, 10, 1, 23, 50), at(2026, 10, 2, 0, 10)),
    ).toBe(1);
    expect(
      calendarDaysBetween(at(2026, 10, 1, 0, 10), at(2026, 10, 2, 23, 50)),
    ).toBe(1);
  });

  it("is negative when `to` is before `from`", () => {
    expect(calendarDaysBetween(at(2026, 10, 5), at(2026, 10, 2))).toBe(-3);
  });

  it("crosses month and year boundaries", () => {
    expect(calendarDaysBetween(at(2026, 9, 27), at(2026, 10, 6))).toBe(9);
    expect(calendarDaysBetween(at(2026, 12, 31, 22), at(2027, 1, 1, 1))).toBe(
      1,
    );
  });

  it("is not thrown off by DST's 23h and 25h days", () => {
    // America/New_York springs forward on 2026-03-08 and falls back on 2026-11-01.
    expect(
      calendarDaysBetween(at(2026, 3, 7, 0, 30), at(2026, 3, 9, 0, 30)),
    ).toBe(2);
    expect(
      calendarDaysBetween(at(2026, 10, 31, 23, 30), at(2026, 11, 2, 0, 30)),
    ).toBe(2);
  });
});

describe("getRigSetupDays", () => {
  const now = at(2026, 10, 2, 0, 10);

  describe("rigged", () => {
    it("is day 0 on the rig day", () => {
      expect(getRigSetupDays(rigged(at(2026, 10, 2, 0, 1)), now)).toEqual({
        status: "rigged",
        days: 0,
        overdue: false,
      });
    });

    it("counts days since the rig day", () => {
      expect(getRigSetupDays(rigged(at(2026, 9, 27, 9)), now)).toMatchObject({
        status: "rigged",
        days: 5,
      });
    });

    it("rolls over at local midnight", () => {
      expect(getRigSetupDays(rigged(at(2026, 10, 1, 23, 50)), now).days).toBe(
        1,
      );
    });

    it("never goes negative when the rig date is in the future", () => {
      expect(getRigSetupDays(rigged(at(2026, 10, 4)), now).days).toBe(0);
    });
  });

  describe("unrigged", () => {
    it("counts the days the line stayed up, ignoring `now`", () => {
      expect(
        getRigSetupDays(unrigged(at(2026, 9, 27, 18), at(2026, 10, 6, 8)), now),
      ).toEqual({ status: "unrigged", days: 9, overdue: false });
    });

    it("is 0 when unrigged on the rig day", () => {
      expect(
        getRigSetupDays(unrigged(at(2026, 9, 27, 8), at(2026, 9, 27, 19)), now)
          .days,
      ).toBe(0);
    });

    it("trusts `is_rigged` over `unrigged_at`, like getRigSetupStatus", () => {
      const setup = {
        ...unrigged(at(2026, 9, 27), at(2026, 9, 30)),
        is_rigged: true,
      };
      expect(getRigSetupDays(setup, now)).toMatchObject({
        status: "rigged",
        days: 5,
      });
    });
  });

  describe("planned", () => {
    it("is day 0 when planned for later today", () => {
      expect(getRigSetupDays(planned(at(2026, 10, 2, 18)), now)).toEqual({
        status: "planned",
        days: 0,
        overdue: false,
      });
    });

    it("counts days until the rig day", () => {
      expect(getRigSetupDays(planned(at(2026, 10, 3, 7)), now)).toEqual({
        status: "planned",
        days: 1,
        overdue: false,
      });
      expect(getRigSetupDays(planned(at(2026, 10, 12)), now).days).toBe(10);
    });

    it("is overdue once the rig day has passed, counting days since", () => {
      expect(getRigSetupDays(planned(at(2026, 9, 30)), now)).toEqual({
        status: "planned",
        days: 2,
        overdue: true,
      });
    });

    it("is not overdue earlier on the rig day itself", () => {
      // Planned for 08:00 today and it is now 00:10: still today, not late.
      expect(getRigSetupDays(planned(at(2026, 10, 2, 8)), now).overdue).toBe(
        false,
      );
      // Planned for 00:01 today and it is now 00:10: same day, still not late.
      expect(getRigSetupDays(planned(at(2026, 10, 2, 0, 1)), now).overdue).toBe(
        false,
      );
    });
  });

  it("defaults `now` to the current time", () => {
    jest.useFakeTimers().setSystemTime(at(2026, 10, 2, 9));
    try {
      expect(getRigSetupDays(rigged(at(2026, 9, 27))).days).toBe(5);
    } finally {
      jest.useRealTimers();
    }
  });
});
