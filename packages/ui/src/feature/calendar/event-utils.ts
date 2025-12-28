import type { Event } from './use-events';

/**
 * Format month key to display string
 * @param monthKey - Format: "YYYY-MM"
 * @param locale - Locale string for formatting (e.g., "en", "pt-BR")
 * @returns Formatted month header (e.g., "January 2025")
 */
export function formatMonthHeader(monthKey: string, locale: string): string {
  const date = new Date(monthKey);
  const month = date.toLocaleString(locale, { month: 'long' });
  const year = date.getFullYear();
  // Capitalize first letter
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

/**
 * Group events by month
 * @param events - Array of events to group
 * @returns Object with month keys (YYYY-MM) mapping to arrays of events
 */
export function groupEventsByMonth(events: Event[]): Record<string, Event[]> {
  const grouped: Record<string, Event[]> = {};

  for (const event of events) {
    const date = new Date(event.start_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(event);
  }

  return grouped;
}
