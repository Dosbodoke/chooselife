"use client";

import { 
  useEvents, 
  formatMonthHeader, 
  groupEventsByMonth,
  type CategoryFilterType,
  extractCountryOptions,
  filterEvents,
} from "@chooselife/ui";
import { CalendarDays, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { SupabaseProvider } from "@chooselife/ui";
import { EventCard } from "@/components/events/EventCard";
import { EventFilters } from "@/components/events/EventFilters";
import { supabaseBrowser } from "@/utils/supabase/client";


export default function EventWrapper() {
  return (
    <SupabaseProvider supabase={supabaseBrowser()}>
      <EventsPage />
    </SupabaseProvider>
  );
}

function EventsPage() {
  const locale = useLocale();
  const { filteredEvents, query } = useEvents();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterType>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Extract unique countries from events with flag emojis
  const countryOptions = useMemo(() => {
    return extractCountryOptions(filteredEvents);
  }, [filteredEvents]);

  // Apply local filters (category + country)
  const locallyFilteredEvents = useMemo(() => {
    return filterEvents(filteredEvents, categoryFilter, countryFilter);
  }, [filteredEvents, categoryFilter, countryFilter]);


  // Group filtered events by month
  const eventsByMonth = useMemo(() => {
    return groupEventsByMonth(locallyFilteredEvents);
  }, [locallyFilteredEvents]);

  const monthKeys = Object.keys(eventsByMonth).sort();
  const hasActiveFilters = categoryFilter !== "all" || countryFilter !== "all";

  return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">
            Upcoming slackline events from around the world
          </p>
        </div>

        {/* Filters */}
        <EventFilters
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          countryOptions={countryOptions}
        />

        {/* Events List */}
        <div className="mt-6">
          {query.isPending ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : monthKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="bg-muted/30 rounded-full p-5">
                <CalendarDays className="size-10 text-muted-foreground" />
              </div>
              <p className="text-center text-muted-foreground text-base">
                {hasActiveFilters
                  ? "No events found for this category."
                  : "No events matching your criteria were found."}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {monthKeys.map((monthKey) => (
                <div key={monthKey}>
                  {/* Month Header */}
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    {formatMonthHeader(monthKey, locale)}
                  </h2>

                  {/* Events Grid */}
                  <div className="space-y-4">
                    {eventsByMonth[monthKey].map((event) => (
                      <EventCard key={event.id} event={event} locale={locale} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
