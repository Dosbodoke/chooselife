import type { Database, Enums, Tables } from "@chooselife/database";

export type FestivalQueueStatus = Enums<"festival_queue_status_enum">;
export type FestivalHighline =
  Database["public"]["Functions"]["get_highline"]["Returns"][number];
export type Festival = Tables<"festival">;
export type FestivalQueueEntryRecord = Tables<"festival_queue_entry">;
export type FestivalSector = Tables<"sector">;

export type FestivalQueueEntry = Pick<
  FestivalQueueEntryRecord,
  | "id"
  | "festival_id"
  | "highline_id"
  | "profile_id"
  | "display_name"
  | "status"
  | "joined_at"
  | "called_at"
  | "completed_at"
  | "removed_at"
  | "removed_by"
> & {
  queuePosition: number;
};

export interface FestivalQueueSummary {
  activeEntries: FestivalQueueEntry[];
  calledEntry: FestivalQueueEntry | null;
  nextEntries: FestivalQueueEntry[];
  waitingCount: number;
  viewerEntry: FestivalQueueEntry | null;
  viewerPosition: number | null;
}

export interface FestivalViewerQueueState {
  userId?: string;
  displayName?: string | null;
  canManage: boolean;
}

export interface FestivalHighlineQueueCard {
  highline: FestivalHighline;
  queueSummary: FestivalQueueSummary;
  sector: Pick<FestivalSector, "id" | "name" | "description"> | null;
  sortOrder: number;
}

export interface FestivalQueueSectorGroup {
  sector: Pick<FestivalSector, "id" | "name" | "description"> | null;
  cards: FestivalHighlineQueueCard[];
}

export interface FestivalQueuePageData {
  festival: Pick<Festival, "id" | "slug" | "name" | "subtitle" | "start_at" | "end_at">;
  highlineIds: string[];
  sectors: FestivalQueueSectorGroup[];
  viewer: FestivalViewerQueueState;
}

export interface FestivalHighlineLink {
  festivalId: string;
  highlineId: string;
  sortOrder: number;
}

export interface JoinFestivalQueueInput {
  festivalSlug: string;
  highlineId: string;
  displayName: string;
}

export interface AddFestivalQueueManualEntryInput {
  festivalSlug: string;
  highlineId: string;
  displayName: string;
}

export interface LeaveFestivalQueueInput {
  entryId: string;
}

export interface CallNextFestivalQueueInput {
  festivalSlug: string;
  highlineId: string;
}

export interface RemoveFestivalQueueEntryInput {
  entryId: string;
}

export interface FestivalQueueMutationResult {
  success: boolean;
  error?: string;
}

export interface JoinFestivalQueueResult extends FestivalQueueMutationResult {
  entry?: FestivalQueueEntryRecord;
}

export interface AddFestivalQueueManualEntryResult
  extends FestivalQueueMutationResult {
  entry?: FestivalQueueEntryRecord;
}

export interface LeaveFestivalQueueResult extends FestivalQueueMutationResult {
  entry?: FestivalQueueEntryRecord;
}

export interface CallNextFestivalQueueResult extends FestivalQueueMutationResult {
  entry?: FestivalQueueEntryRecord | null;
}

export interface RemoveFestivalQueueEntryResult extends FestivalQueueMutationResult {
  entry?: FestivalQueueEntryRecord;
}
