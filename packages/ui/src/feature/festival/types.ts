import type { Database, Tables } from "@chooselife/database";

export type FestivalHighline =
  Database["public"]["Functions"]["get_highline"]["Returns"][number];
export type Festival = Tables<"festival">;
export type FestivalScheduleSlotRecord = Tables<"festival_schedule_slot">;
export type FestivalScheduleBookingRecord =
  Database["public"]["Functions"]["get_festival_schedule_bookings"]["Returns"][number];
export type FestivalScheduleBookingMutationRecord =
  Tables<"festival_schedule_booking">;
export type FestivalScheduleWindowRecord = Tables<"festival_schedule_window">;
export type FestivalSector = Tables<"sector">;
export type FestivalProfile = Pick<Tables<"profiles">, "id" | "name" | "username">;

export type FestivalScheduleSlotState =
  | "available"
  | "booked"
  | "blocked"
  | "completed"
  | "expired";

export type FestivalScheduleBookingBlockedReason =
  | "window_not_open"
  | "overlap"
  | "limit";

export interface FestivalParticipantDisplay {
  primaryText: string;
  secondaryText?: string | null;
}

export interface FestivalScheduleBookingView {
  id: string;
  participant: FestivalParticipantDisplay;
  isViewer: boolean;
  status: FestivalScheduleBookingRecord["status"];
}

export interface FestivalScheduleSlotView {
  id: string;
  highlineId: string;
  startAt: string;
  endAt: string;
  state: FestivalScheduleSlotState;
  blockReason?: string | null;
  booking?: FestivalScheduleBookingView | null;
  isCurrent: boolean;
  isClaimable: boolean;
  bookingBlockedReason?: FestivalScheduleBookingBlockedReason | null;
}

export type FestivalFeaturedSlot = FestivalScheduleSlotView;

export interface FestivalScheduleDay {
  dateKey: string;
  slots: FestivalScheduleSlotView[];
  availableCount: number;
  preOpenAvailableCount: number;
  bookingOpensAt: string | null;
  isBookingOpen: boolean;
  featuredSlot: FestivalFeaturedSlot | null;
  isCurrentDay: boolean;
}

export interface FestivalViewerState {
  userId?: string;
  username?: string | null;
  displayName?: string | null;
  canManage: boolean;
}

export interface FestivalHighlineScheduleCard {
  highline: FestivalHighline;
  sector: Pick<FestivalSector, "id" | "name" | "description"> | null;
  sortOrder: number;
  days: FestivalScheduleDay[];
  dayKeys: string[];
  defaultDayKey: string | null;
  defaultDay: FestivalScheduleDay | null;
  availableCount: number;
  preOpenAvailableCount: number;
  bookingOpensAt: string | null;
  isBookingOpen: boolean;
  featuredSlot: FestivalFeaturedSlot | null;
}

export interface FestivalScheduleSectorGroup {
  sector: Pick<FestivalSector, "id" | "name" | "description"> | null;
  cards: FestivalHighlineScheduleCard[];
}

export interface FestivalSchedulePageData {
  bookingCooldownEndsAt?: string | null;
  bookingLimit: number;
  festival: Pick<
    Festival,
    "id" | "slug" | "name" | "subtitle" | "start_at" | "end_at" | "timezone"
  >;
  highlineIds: string[];
  sectors: FestivalScheduleSectorGroup[];
  viewer: FestivalViewerState;
}

export interface FestivalHighlineLink {
  festivalId: string;
  highlineId: string;
  sortOrder: number;
  slotDurationMinutes: number;
}

export interface BookFestivalScheduleSlotInput {
  slotId: string;
  profileId?: string | null;
  instagramUsername?: string | null;
  displayName?: string | null;
}

export interface CancelFestivalScheduleBookingInput {
  bookingId: string;
  reason: string;
}

export interface FestivalScheduleMutationResult {
  success: boolean;
  error?: string;
}

export interface BookFestivalScheduleSlotResult
  extends FestivalScheduleMutationResult {
  booking?: FestivalScheduleBookingMutationRecord;
}

export interface CancelFestivalScheduleBookingResult
  extends FestivalScheduleMutationResult {
  booking?: FestivalScheduleBookingMutationRecord;
}
