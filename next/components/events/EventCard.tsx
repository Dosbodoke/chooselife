"use client";

import { CalendarIcon, ChevronDown, MapPin, ExternalLink } from "lucide-react";
import { useState } from "react";
import { type Event, isISAEvent, getCountryFlag } from "@chooselife/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** Category colors for badge */
const CATEGORY_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  contests: { bg: "bg-blue-50", dot: "bg-blue-500", text: "text-blue-700" },
  education: { bg: "bg-green-50", dot: "bg-green-500", text: "text-green-700" },
  events: { bg: "bg-orange-50", dot: "bg-orange-500", text: "text-orange-700" },
};

/** Category gradient colors for date box - Using dark gradient like mobile app */
const CATEGORY_GRADIENTS: Record<string, string> = {
  contests: "from-slate-900 to-slate-800",
  education: "from-slate-900 to-slate-800",
  events: "from-slate-900 to-slate-800",
  default: "from-slate-900 to-slate-800",
};

/** Get category label */
function getCategoryLabel(type?: string): string {
  switch (type) {
    case "contests":
      return "Contest";
    case "education":
      return "Education";
    case "events":
      return "Festival";
    default:
      return "Event";
  }
}

/** Category Badge component */
function CategoryBadge({ type }: { type?: string }) {
  const colors = CATEGORY_COLORS[type || ""] || {
    bg: "bg-gray-50",
    dot: "bg-gray-500",
    text: "text-gray-700",
  };
  const label = getCategoryLabel(type);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-gray-200/50",
        colors.bg,
        colors.text
      )}
    >
      <span className={cn("size-2 rounded-full", colors.dot)} />
      {label}
    </span>
  );
}

/** ISA Badge component - shows ISA source indicator */
function ISABadge() {
  return (
    <svg width={52} height={28} viewBox="0 0 565 300" fill="none">
      <path
        fill="#E93F27"
        d="M166.923 107.443c11.12 4.487 27.039 9.353 38.567 13.264a7279.577 7279.577 0 0 1 71.375 24.45c9.878 3.418 20.123 6.415 29.931 10.018 2.067.759 4.398 2.438 6.059 3.916 7.81 6.939 12.618 16.798 13.36 27.4 1.465 20.436-13.355 41.533-33.661 42.91-4.404.623-11.763.411-16.389.401l-24.554-.027-84.76.057c-.463-5.483.01-19.075.013-25.31l-.13-55.195c10.707.4 24.176.115 35.18.263-21.9-4.883-34.801-18.484-34.991-42.147Z"
      />
      <path
        fill="#009F98"
        d="M202.663 69.168c2.533-.39 15.287-.172 18.238-.17l40.196.017c46.782-.014 94.173-.43 140.888.104-2.221 5.182-10.531 18.882-13.662 24.327l-27.896 48.733c-1.284 2.41-2.659 4.698-4.049 7.04l-24.957.204c-3.895.033-7.801.08-11.695.063-7.841-.035-15.563-3.346-22.941-5.894l-27.71-9.526-63.754-21.621c-12.281-4.18-25.299-8.346-37.406-12.906 5.153-17.507 16.867-28.465 34.748-30.371Z"
      />
      <path
        fill="#E93F27"
        d="M78.09 77.32c26.464 7.77 54.128 19.094 80.879 27.24.218 11.308-.141 22.67-.116 33.969l.114 89.123-.227 1.754c-1.672.96-71.367.355-80.539.436-.149-4.39-.033-8.896-.065-13.3-.346-46.376.485-92.86-.046-139.223ZM352.919 171.045c3.897.876 12.137 3.996 16.053 5.36l28.009 9.613c2.7.923 12.568 4.588 14.547 4.306 19.81-2.83 41.774-10.87 61.304-14.145 10.168 16.14 21.105 36.759 30.803 53.662l-19.056-.037-165.205.062c.985-1.823 2.088-3.685 3.135-5.475 10.331-17.662 20.124-35.661 30.41-53.346Z"
      />
      <path
        fill="#009F98"
        d="M411.281 69.207c2.289 2.08 14.547 24.487 16.778 28.384l40.769 71.342c-17.807 4.38-35.988 8.426-53.708 13.03-6.313 1.065-18.024-4.031-24.452-6.23a2819.387 2819.387 0 0 0-33.82-11.359c5.498-10.37 12.594-21.855 18.493-32.176l35.94-62.991ZM78.885 69.191c8.229-.494 19.433-.151 28.007-.15l52.083.02c.35 8.221.015 18.749-.093 27.057-1.313.15-78.936-26.094-79.997-26.927Z"
      />
    </svg>
  );
}

interface EventCardProps {
  event: Event;
  locale?: string;
}

export function EventCard({ event, locale = "en" }: EventCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isFromISA = isISAEvent(event);
  const eventType = isFromISA ? event.type : "default";

  const startDate = new Date(event.start_date);
  const monthShort = startDate.toLocaleString(locale, { month: "short" }).toUpperCase();
  const dayOfMonth = startDate.getDate();

  const gradientClass = CATEGORY_GRADIENTS[eventType || "default"] || CATEGORY_GRADIENTS.default;
  const countryFlag = getCountryFlag(event.country);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="relative bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        {/* Country Flag Background */}
        {countryFlag && (
          <div className="absolute top-0 -right-6 z-0 overflow-hidden pointer-events-none">
            <span
              className="text-[120px] opacity-20"
              style={{ transform: "rotate(15deg)", display: "block" }}
            >
              {countryFlag}
            </span>
          </div>
        )}

        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="flex gap-4">
              {/* Date Box */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl p-3 min-w-[72px] min-h-[72px] bg-gradient-to-br text-white",
                  gradientClass
                )}
              >
                <span className="text-[10px] font-bold tracking-wider opacity-90">
                  {monthShort}
                </span>
                <span className="text-3xl font-black -mt-0.5">{dayOfMonth}</span>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0 space-y-1">
                {/* Title Row */}
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-base text-foreground line-clamp-2">
                    {event.title}
                  </h3>
                  <ChevronDown
                    className={cn(
                      "size-5 text-muted-foreground shrink-0 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>

                {/* Location */}
                <div className="inline-flex items-center gap-1.5 bg-muted/60 px-2.5 py-1.5 rounded-xl text-sm font-medium">
                  <MapPin className="size-3.5 text-primary" />
                  <span className="truncate">
                    {event.city}
                    {event.state ? `, ${event.state}` : ""}
                    {event.country ? ` · ${event.country}` : ""}
                  </span>
                </div>

                {/* Badges */}
                {isFromISA && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <CategoryBadge type={event.type} />
                  </div>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* ISA Badge - Bottom Right */}
        {isFromISA && (
          <div className="absolute bottom-3 right-3 z-10">
            <ISABadge />
          </div>
        )}

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="border-t border-border/50 pt-4 space-y-4">
              {/* Description */}
              {event.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description.replace(/<[^>]*>/g, "")}
                </p>
              )}

              {/* Info Pills */}
              <div className="flex flex-wrap gap-2">
                <div className="inline-flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-xl text-sm font-medium">
                  <CalendarIcon className="size-4 text-primary" />
                  <span>
                    {startDate.toLocaleDateString(locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Registration Link */}
              {event.registration_url && (
                <Button asChild className="w-full sm:w-auto">
                  <a
                    href={event.registration_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-2"
                  >
                    {isFromISA ? "View Details" : "Book Now"}
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
