import type { ISACalendarType } from './constants';

/**
 * Represents an event from the ISA Google Calendar
 */
export interface ISAEvent {
  /** Unique identifier (prefixed with calendar type) */
  id: string;
  /** Event title/summary */
  title: string;
  /** Event description (may contain HTML) */
  description: string | null;
  /** Start date/time as ISO string */
  start_date: string;
  /** End date/time as ISO string */
  end_date: string | null;
  /** Location string from the calendar event */
  location: string | null;
  /** Parsed city from location (best effort) */
  city: string;
  /** Parsed country from location (best effort) */
  country: string;
  /** Parsed state/region from location (best effort) */
  state: string | null;
  /** Link to the original Google Calendar event */
  registration_url: string | null;
  /** Event type (based on which calendar it came from) */
  type: ISACalendarType;
  /** Source indicator */
  source: 'isa';
}

/**
 * Raw parsed iCal event from ical.js
 */
export interface ParsedICalEvent {
  uid: string;
  summary?: string;
  description?: string;
  dtstart?: Date;
  dtend?: Date;
  location?: string;
  url?: string;
}
