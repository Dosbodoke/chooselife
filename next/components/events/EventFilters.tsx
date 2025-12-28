"use client";

import { cn } from "@/lib/utils";
import { type CategoryFilterType, CATEGORY_FILTERS, type CountryOption } from "@chooselife/ui";

interface FilterChipProps {
  label: string;
  isSelected: boolean;
  dotColor?: string;
  onClick: () => void;
}

function FilterChip({ label, isSelected, dotColor, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-colors",
        isSelected
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-foreground border-border hover:bg-muted"
      )}
    >
      {dotColor && <span className={cn("size-2 rounded-full", dotColor)} />}
      {label}
    </button>
  );
}

interface EventFiltersProps {
  categoryFilter: CategoryFilterType;
  setCategoryFilter: (filter: CategoryFilterType) => void;
  countryFilter: string;
  setCountryFilter: (filter: string) => void;
  countryOptions: CountryOption[];
}

export function EventFilters({
  categoryFilter,
  setCategoryFilter,
  countryFilter,
  setCountryFilter,
  countryOptions,
}: EventFiltersProps) {
  return (
    <div className="space-y-3 bg-card rounded-xl border border-border p-4">
      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((filter) => (
          <FilterChip
            key={filter.key}
            label={filter.key === "all" ? "All" : filter.key === "contests" ? "Contests" : filter.key === "education" ? "Education" : "Festivals"}
            isSelected={categoryFilter === filter.key}
            dotColor={filter.dotColor}
            onClick={() => setCategoryFilter(filter.key)}
          />
        ))}
      </div>

      {/* Country Filters */}
      {countryOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All Countries"
            isSelected={countryFilter === "all"}
            onClick={() => setCountryFilter("all")}
          />
          {countryOptions.map((country) => (
            <FilterChip
              key={country.name}
              label={country.label}
              isSelected={countryFilter === country.name}
              onClick={() => setCountryFilter(country.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { CategoryFilterType };

