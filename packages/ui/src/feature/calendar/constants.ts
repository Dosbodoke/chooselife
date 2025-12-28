/**
 * ISA (International Slackline Association) Calendar IDs
 * These are public Google Calendar IDs for slackline events worldwide
 */
export const ISA_CALENDARS = {
  contests: {
    id: 'c_313178c5777ceec7db1a61cf939f51f8cd9ec9c7b33411f4ef4ee4f3e32ea0d6@group.calendar.google.com',
    name: 'Slackline Contests',
    color: '#9fc6e7',
  },
  education: {
    id: 'c_8945c3e37764ebbe6f770fbfa454eaa41f98975a480623031a3ee05c8ca54d66@group.calendar.google.com',
    name: 'Slackline Education',
    color: '#cca6ac',
  },
  events: {
    id: 'slacklineinternational.org_vkg41vk9rou3ge6tg2ro3q3qco@group.calendar.google.com',
    name: 'Slackline Events / Festival',
    color: '#b3dc6c',
  },
} as const;

export type ISACalendarType = keyof typeof ISA_CALENDARS;

/**
 * Get the public iCal URL for a Google Calendar
 */
export function getICalUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}
