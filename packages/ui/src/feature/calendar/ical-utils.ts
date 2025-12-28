import ICAL from 'ical.js';

import type { ISAEvent, ParsedICalEvent } from './types';
import type { ISACalendarType } from './constants';

/**
 * Parse an iCal string into an array of events
 */
export function parseICalData(icalString: string): ParsedICalEvent[] {
  try {
    const jcalData = ICAL.parse(icalString);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    return vevents.map((vevent) => {
      const event = new ICAL.Event(vevent);
      return {
        uid: event.uid,
        summary: event.summary,
        description: event.description,
        dtstart: event.startDate?.toJSDate(),
        dtend: event.endDate?.toJSDate(),
        location: event.location,
        url: vevent.getFirstPropertyValue('url') as string | undefined,
      };
    });
  } catch (error) {
    console.error('Failed to parse iCal data:', error);
    return [];
  }
}

/**
 * Parse a location string into city, state, and country
 * This is a best-effort parsing since locations can be in many formats
 */
export function parseLocation(location: string | null | undefined): {
  city: string;
  state: string | null;
  country: string;
} {
  if (!location) {
    return { city: 'TBD', state: null, country: '' };
  }

  // Clean up the location string
  const cleaned = location.trim();
  
  // Try to split by comma
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 3) {
    // Format: "Venue, City, State, Country" or "City, State, Country"
    return {
      city: parts[parts.length - 3] || parts[0],
      state: parts.length > 3 ? parts[parts.length - 2] : null,
      country: parts[parts.length - 1],
    };
  } else if (parts.length === 2) {
    // Format: "City, Country" or "City, State"
    return {
      city: parts[0],
      state: null,
      country: parts[1],
    };
  } else {
    // Single part - try to extract city and country from space-separated
    // e.g., "Niteroi Brazil" or "Tehran Iran"
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) {
      // Last word is likely the country
      const country = words[words.length - 1];
      const city = words.slice(0, -1).join(' ');
      return {
        city,
        state: null,
        country,
      };
    }
    // Just a single word, use as city with no country
    return {
      city: cleaned,
      state: null,
      country: '',
    };
  }
}

/**
 * Convert a parsed iCal event to an ISAEvent
 */
export function toISAEvent(
  event: ParsedICalEvent,
  calendarType: ISACalendarType,
  calendarId: string
): ISAEvent | null {
  // Skip events without required fields
  if (!event.dtstart || !event.summary) {
    return null;
  }

  const { city, state, country } = parseLocation(event.location);

  // Use the URL from the event if available, otherwise null
  // The event URL typically points to registration forms or event pages
  const registrationUrl = event.url || null;

  return {
    id: `isa-${calendarType}-${event.uid}`,
    title: event.summary,
    description: event.description || null,
    start_date: event.dtstart.toISOString(),
    end_date: event.dtend?.toISOString() || null,
    location: event.location || null,
    city,
    state,
    country,
    registration_url: registrationUrl,
    type: calendarType,
    source: 'isa',
  };
}

/**
 * Fetch and parse events from an iCal URL
 * 
 * @param calendarId - The Google Calendar ID
 * @param calendarType - The type of ISA calendar
 * @param options - Optional configuration
 * @param options.proxyBaseUrl - Base URL for CORS proxy (e.g., '/api/ical'). 
 *   If provided, requests will be made to `{proxyBaseUrl}?url={encodedIcalUrl}`
 *   This is required for browser environments due to CORS restrictions.
 */
export async function fetchISACalendarEvents(
  calendarId: string,
  calendarType: ISACalendarType,
  options?: { proxyBaseUrl?: string }
): Promise<ISAEvent[]> {
  const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

  // Use proxy if proxyBaseUrl is provided (browser environment)
  const fetchUrl = options?.proxyBaseUrl
    ? `${options.proxyBaseUrl}?url=${encodeURIComponent(icalUrl)}`
    : icalUrl;

  const response = await fetch(fetchUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar: ${response.statusText}`);
  }

  const icalString = await response.text();
  const parsedEvents = parseICalData(icalString);

  return parsedEvents
    .map((event) => toISAEvent(event, calendarType, calendarId))
    .filter((event): event is ISAEvent => event !== null);
}
