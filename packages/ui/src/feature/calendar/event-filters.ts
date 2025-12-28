import type { Event } from './use-events';
import { isISAEvent } from './use-events';
import { getCountryFlag, normalizeCountryName } from './country-flags';

/**
 * Category filter type for ISA events
 */
export type CategoryFilterType = 'all' | 'contests' | 'education' | 'events';

/**
 * Category filter configuration
 */
export interface CategoryFilter {
  key: CategoryFilterType;
  labelKey: string;
  dotColor: string;
}

/**
 * Available category filters with i18n label keys and dot colors
 */
export const CATEGORY_FILTERS: CategoryFilter[] = [
  { key: 'all', labelKey: 'app.events.filters.all', dotColor: '' },
  { key: 'contests', labelKey: 'app.events.filters.contests', dotColor: 'bg-blue-500' },
  { key: 'education', labelKey: 'app.events.filters.education', dotColor: 'bg-green-500' },
  { key: 'events', labelKey: 'app.events.filters.festivals', dotColor: 'bg-orange-500' },
];

/**
 * Country option with flag emoji
 */
export interface CountryOption {
  /** Canonical country name (used for filtering) */
  name: string;
  /** Country flag emoji */
  flag: string;
  /** Display label (flag + name) */
  label: string;
}

/**
 * Extract unique countries from events with flag emojis
 * Normalizes country name variants (e.g., "Brasil" and "Brazil" become "Brazil")
 * @param events - Array of events to extract countries from
 * @returns Sorted array of country options with flags
 */
export function extractCountryOptions(events: Event[] | undefined): CountryOption[] {
  if (!events) return [];

  const countriesMap = new Map<string, CountryOption>();

  for (const event of events) {
    if (event.country && event.country !== 'TBD' && event.country.trim()) {
      // Normalize country name to handle variants like "Brasil"/"Brazil"
      const canonicalName = normalizeCountryName(event.country);
      
      if (!countriesMap.has(canonicalName)) {
        const flag = getCountryFlag(event.country);
        countriesMap.set(canonicalName, {
          name: canonicalName,
          flag,
          label: flag ? `${flag} ${canonicalName}` : canonicalName,
        });
      }
    }
  }

  return Array.from(countriesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter events by category and country
 * @param events - Array of events to filter
 * @param categoryFilter - Category filter value ('all' or specific category)
 * @param countryFilter - Country filter value ('all' or canonical country name)
 * @returns Filtered array of events
 */
export function filterEvents(
  events: Event[] | undefined,
  categoryFilter: CategoryFilterType,
  countryFilter: string
): Event[] {
  if (!events) return [];

  return events.filter((event) => {
    // Category filter
    if (categoryFilter !== 'all') {
      if (!isISAEvent(event)) {
        return false; // Internal events don't match category filters
      }
      if (event.type !== categoryFilter) {
        return false;
      }
    }

    // Country filter - normalize event country to match against canonical name
    if (countryFilter !== 'all') {
      const eventCountryNormalized = normalizeCountryName(event.country);
      if (eventCountryNormalized !== countryFilter) {
        return false;
      }
    }

    return true;
  });
}

