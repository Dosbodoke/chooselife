"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useQueryState } from "nuqs";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const chartTheme = {
  light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  dark: ["#2d333b", "#0e4429", "#006d32", "#26a641", "#39d353"],
};

// MOVE TO UTILS?
function zellersCongruence(date: Date): number {
  const dateDay = date.getDate();
  let month = date.getMonth();
  let year = date.getFullYear();
  // in algorithm friendly version, January and February are counted as
  //month 13 and 14 respectively of previous year
  if (month < 2) {
    year--;
    month = month + 13; // January is index "0", so add 13
  } else {
    month++; // since getMonth index starts at 0 must add one to get correct month
  }

  const monthAdjustment = Math.floor((13 * (month + 1)) / 5);

  const leapYearAdjustment = Math.floor(year / 4); //use floor so equals zero except in leap year for +1 day
  const centuryAdjustment = year / 100; // Math.floor on zellersNumber adjusts this one
  const fourHundredYearFudgeFactor = Math.floor(year / 400); // use floor again so adds one day every 400 years
  const zellersNumber = Math.floor(
    dateDay +
      monthAdjustment +
      year +
      leapYearAdjustment -
      centuryAdjustment +
      fourHundredYearFudgeFactor
  );

  // 0 for sunday, 6 for saturday
  const dayOfWeek = zellersNumber % 7;
  return dayOfWeek;
}

function getDayFromCell(coordinates: [x: number, y: number], offset: number) {
  const [x, y] = coordinates;

  // y is the one columns before the current
  // multiplied by 7 since each column has 7 days
  // minus the offset of zeelers congruence, if it's 7 starts on the first day of the year
  // plus ( x + 1 ) that is the number of days on the current columns
  const currentDay = 7 * y - (offset === 7 ? 0 : offset) + (x + 1);
  return currentDay;
}

function getColSpan(year: number) {
  const yearStartedAt = zellersCongruence(new Date(`${year}-01-01`));

  const isLeapYear = leapYear(year);

  const daysInMonth = [
    31,
    28 + (isLeapYear ? 1 : 0),
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  let currentMonthIdx = 0;
  let daysGone = 0;
  let weeksGone = 0;
  const monthColSpan: Array<{ month: number; colSpan: number }> = [];

  for (let y = 0; y < 53; y++) {
    for (let x = 0; x < 7; x++) {
      let currentDay = getDayFromCell([x, y], yearStartedAt + 1);
      if (currentDay === daysInMonth[currentMonthIdx] + daysGone) {
        monthColSpan.push({
          month: currentMonthIdx,
          colSpan: y + 1 - weeksGone,
        });
        weeksGone = y + 1;
        daysGone += daysInMonth[currentMonthIdx];
        currentMonthIdx += 1;
      }
    }
  }

  return monthColSpan;
}

function leapYear(year: number) {
  // Every year that is exactly divisible by four is a leap year,
  // except for years that are exactly divisible by 100,
  // but these centurial years are leap years, if they are exactly divisible by 400
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getSunday(increment: number) {
  const d = new Date();
  d.setHours(15, 0, 0, 0); /* normalise */
  d.setDate(d.getDate() - d.getDay() + increment); /* Sunday + increment */
  return d;
}

interface HeatmapProps extends React.HTMLAttributes<HTMLTableElement> {
  year: number;
  data: {
    [date: string]: number;
  };
}
const Heatmap = React.forwardRef<HTMLTableElement, HeatmapProps>(
  ({ year, data, className, ...props }, ref) => {
    const [mounted, setMounted] = React.useState(false);

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) {
      return <HeatmapSkeleton />;
    }

    return (
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <div className="scrollbar relative max-w-full overflow-x-auto overflow-y-hidden">
          <table
            ref={ref}
            className={cn(
              "relative w-max caption-bottom border-separate border-spacing-[3px] overflow-hidden text-sm",
              className
            )}
            {...props}
          >
            <HeatmapHeader year={year} />
            <HeatmapBody year={year} data={data} />
          </table>
        </div>
      </TooltipProvider>
    );
  }
);
Heatmap.displayName = "Heatmap";

interface HeatmapLabelProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  year: number;
}
const HeatmapHeader = React.forwardRef<
  HTMLTableSectionElement,
  HeatmapLabelProps
>(({ year, className, ...props }, ref) => {
  const format = useFormatter();

  return (
    <thead ref={ref} className={cn(className)} {...props}>
      <tr className="h-[13px]">
        {/* WEEKDAY LABEL COLUMN */}
        <td className="w-7"></td>
        {getColSpan(year).map(({ month, colSpan }) => (
          <td
            key={`month-${month}`}
            colSpan={colSpan}
            className="relative py-[0.125rem] pr-2 text-left"
          >
            <span className="sr-only">
              {format.dateTime(new Date(year, month), { month: "long" })}
            </span>
            <span className="absolute top-0">
              {format.dateTime(new Date(year, month), { month: "short" })}
            </span>
          </td>
        ))}
      </tr>
    </thead>
  );
});
HeatmapHeader.displayName = "HeatmapHeader";

interface HeatmapBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  classname?: string;
  data: {
    [date: string]: number;
  };
  year: number;
}
const HeatmapBody = React.forwardRef<HTMLTableSectionElement, HeatmapBodyProps>(
  ({ data, year, className, ...props }, ref) => {
    const { resolvedTheme } = useTheme();
    const format = useFormatter();
    const isLeapYear = leapYear(year);
    const yearStartedAt = zellersCongruence(new Date(`${year}-01-01`));
    const yearTotalDays = isLeapYear ? 366 : 365;

    const getLevel = React.useCallback((value: number) => {
      if (!value || value === 0) return 0;
      if (value < 3) return 1;
      if (value < 5) return 2;
      if (value < 8) return 3;
      return 4;
    }, []);

    return (
      <tbody ref={ref} className={cn("", className)} {...props}>
        {new Array(7).fill(null).map((_, week) => (
          <tr key={`week=${week}`}>
            {/* WEEKDAY LABEL */}
            {week % 2 !== 0 ? (
              <td className="relative py-[0.125rem] pr-2 text-left">
                <span className="sr-only">
                  {format.dateTime(getSunday(week), {
                    weekday: "short",
                  })}
                </span>
                <span aria-hidden={true} className="absolute -bottom-[3px]">
                  {format.dateTime(getSunday(week), {
                    weekday: "short",
                  })}
                </span>
              </td>
            ) : (
              <td className="relative py-[0.125rem] pr-2 text-left"></td>
            )}

            {new Array(53).fill(null).map((_, i) => {
              const coordinates = [week, i] as [x: number, y: number];
              const dayOfTheYear = getDayFromCell(
                coordinates,
                // TODO: Understant why I need to +1
                yearStartedAt + 1
              );
              const isValidDay =
                dayOfTheYear > 0 && dayOfTheYear <= yearTotalDays;

              const date = new Date(year, 0, dayOfTheYear);
              const dateStr = date.toISOString().split("T")[0];

              return (
                <HeatmapCell
                  key={`heatmap-day-${coordinates[0]}-${coordinates[1]}`}
                  coordinates={coordinates}
                  date={date}
                  dateStr={dateStr}
                  hidden={!isValidDay}
                  cellColor={
                    chartTheme[resolvedTheme as "dark" | "light"][
                      getLevel(data[dateStr])
                    ]
                  }
                  amount={data[dateStr]}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    );
  }
);
HeatmapBody.displayName = "HeatmapBody";

interface HeatmapCellProps {
  coordinates: [x: number, y: number];
  date: Date;
  dateStr: string;
  hidden: boolean;
  cellColor: string;
  amount: number;
}
function HeatmapCell({
  coordinates,
  date,
  dateStr,
  hidden,
  cellColor,
  amount,
}: HeatmapCellProps) {
  const [open, setOpen] = React.useState(false);

  const t = useTranslations("calendar");
  const format = useFormatter();

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <td
          id={`heatmap-day-${coordinates[0]}-${coordinates[1]}`}
          data-date={dateStr}
          data-ix={coordinates[1]}
          aria-hidden={hidden}
          className="h-3 w-3 rounded-sm outline-1 -outline-offset-1 outline-gray-600 aria-hidden:opacity-0"
          style={{
            backgroundColor: cellColor,
          }}
          onClick={() => setOpen((prev) => !prev)}
          onBlur={() => setOpen(false)}
        />
      </TooltipTrigger>
      {amount ? (
        <TooltipPortal>
          <TooltipContent side="top" align="center" sideOffset={4}>
            <p>
              {t("tooltip", { walks: amount })}{" "}
              {format.dateTime(date, {
                day: "numeric",
                month: "short",
              })}
            </p>
            <TooltipArrow />
          </TooltipContent>
        </TooltipPortal>
      ) : null}
    </Tooltip>
  );
}

const HeatmapSkeleton = () => (
  <div className="scrollbar relative max-w-full overflow-x-auto overflow-y-hidden">
    <table
      className={cn(
        "relative w-max caption-bottom border-separate border-spacing-[3px] animate-pulse overflow-hidden text-sm"
      )}
    >
      <thead>
        <tr className="h-[13px]">
          <td className="w-7"></td>
          {}
          {new Array(12).fill(null).map((_, i) => (
            <td
              key={`month-${i}`}
              colSpan={4}
              className="relative py-[0.125rem] pr-2 text-left"
            >
              <span className="absolute top-0 h-2 w-8 rounded-sm bg-primary" />
            </td>
          ))}
        </tr>
      </thead>
      <tbody>
        {new Array(7).fill(null).map((_, week) => (
          <tr key={`week=${week}`}>
            {/* WEEKDAY LABEL */}
            {week % 2 !== 0 ? (
              <td className="relative py-[0.125rem] pr-2 text-left">
                <span
                  aria-hidden={true}
                  className="absolute h-2 w-6 rounded-sm bg-primary"
                ></span>
              </td>
            ) : (
              <td className="relative py-[0.125rem] pr-2 text-left"></td>
            )}

            {new Array(53).fill(null).map((_, i) => {
              const coordinates = [week, i] as [x: number, y: number];

              return (
                <td
                  key={`heatmap-day-${coordinates[0]}-${coordinates[1]}`}
                  id={`heatmap-day-${coordinates[0]}-${coordinates[1]}`}
                  data-ix={coordinates[1]}
                  className="h-3 w-3 rounded-sm bg-primary outline-1 -outline-offset-1 outline-gray-600 aria-hidden:opacity-0"
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface Props {
  years: string[];
  selectedYear: string;
}
const YearSwitcher = ({ years, selectedYear }: Props) => {
  const [year, setYear] = useQueryState("year");

  function handleYearChange(year: string) {
    setYear(year);
  }

  return (
    <Select value={selectedYear} onValueChange={handleYearChange}>
      <SelectTrigger className="w-20">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={`year-${y}`} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export { Heatmap, YearSwitcher };
