import type { TypedSupabaseClient } from "../../supabase-provider";

import type { Database, Tables } from "@chooselife/database";

import {
  buildFestivalScheduleCards,
  groupFestivalCardsBySector,
} from "./selectors";
import type {
  BookFestivalScheduleSlotInput,
  BookFestivalScheduleSlotResult,
  CancelFestivalScheduleBookingInput,
  CancelFestivalScheduleBookingResult,
  FestivalHighlineLink,
  FestivalProfile,
  FestivalSchedulePageData,
  FestivalViewerState,
} from "./types";

type Festival = Tables<"festival">;
type Sector = Pick<Tables<"sector">, "id" | "name" | "description">;
type Profile = Pick<Tables<"profiles">, "id" | "name" | "username">;

const FESTIVAL_SCHEDULE_MUTATION_ERROR = "festival_schedule_mutation_failed";
const FESTIVAL_SCHEDULE_BOOKING_NOT_OPEN_ERROR =
  "festival_schedule_booking_not_open_yet";
const FESTIVAL_SCHEDULE_BOOKING_OVERLAP_ERROR =
  "festival_schedule_booking_overlap";
const FESTIVAL_SCHEDULE_BOOKING_LIMIT_ERROR =
  "festival_schedule_booking_limit";

function mapFestivalScheduleBookingError(message: string | undefined) {
  if (!message) return FESTIVAL_SCHEDULE_MUTATION_ERROR;

  if (message.includes("concurrent schedule booking")) {
    return FESTIVAL_SCHEDULE_BOOKING_OVERLAP_ERROR;
  }

  if (message.includes("two active schedule bookings")) {
    return FESTIVAL_SCHEDULE_BOOKING_LIMIT_ERROR;
  }

  if (message.includes("not open yet")) {
    return FESTIVAL_SCHEDULE_BOOKING_NOT_OPEN_ERROR;
  }

  return FESTIVAL_SCHEDULE_MUTATION_ERROR;
}

async function requireFestivalBySlug(
  supabase: TypedSupabaseClient,
  festivalSlug: string,
) {
  const { data: festival, error } = await supabase
    .from("festival")
    .select("*")
    .eq("slug", festivalSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!festival) {
    throw new Error(`Festival not found for slug "${festivalSlug}"`);
  }

  return festival as Festival;
}

async function getViewerProfile(
  supabase: TypedSupabaseClient,
  userId: string | undefined,
) {
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return profile as Profile | null;
}

function getFallbackDisplayName(profile: Profile | null) {
  const name = profile?.name?.trim();
  if (name) return name;

  const username = profile?.username?.trim();
  if (username) return username;

  return "";
}

async function loadViewerState(args: {
  festivalId: string;
  supabase: TypedSupabaseClient;
  userId?: string;
}) {
  const profile = await getViewerProfile(args.supabase, args.userId);

  const staffMembership = args.userId
    ? await args.supabase
        .from("festival_staff")
        .select("profile_id")
        .eq("festival_id", args.festivalId)
        .eq("profile_id", args.userId)
        .maybeSingle()
    : { data: null, error: null };

  if (staffMembership.error) {
    throw new Error(staffMembership.error.message);
  }

  return {
    profile,
    viewer: {
      userId: args.userId,
      username: profile?.username ?? null,
      displayName: getFallbackDisplayName(profile),
      canManage: !!staffMembership.data,
    } satisfies FestivalViewerState,
  };
}

async function reconcileFestivalScheduleForRead(
  supabase: TypedSupabaseClient,
  festivalId: string,
) {
  const { error } = await supabase.rpc("reconcile_festival_schedule_by_id", {
    target_festival_id: festivalId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getFestivalSchedulePageData(args: {
  festivalSlug: string;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<FestivalSchedulePageData> {
  const festival = await requireFestivalBySlug(args.supabase, args.festivalSlug);
  await reconcileFestivalScheduleForRead(args.supabase, festival.id);

  const [
    { data: highlineLinks, error: linksError },
    { data: windows, error: windowsError },
    { data: slots, error: slotsError },
    { data: bookings, error: bookingsError },
    { profile, viewer },
  ] = await Promise.all([
    args.supabase
      .from("festival_highline")
      .select("festival_id, highline_id, sort_order, slot_duration_minutes")
      .eq("festival_id", festival.id)
      .order("sort_order", { ascending: true }),
    args.supabase
      .from("festival_schedule_window")
      .select("*")
      .eq("festival_id", festival.id)
      .order("window_start_at", { ascending: true }),
    args.supabase
      .from("festival_schedule_slot")
      .select("*")
      .eq("festival_id", festival.id)
      .order("start_at", { ascending: true }),
    args.supabase.rpc("get_festival_schedule_bookings", {
      target_festival_id: festival.id,
    }),
    loadViewerState({
      festivalId: festival.id,
      supabase: args.supabase,
      userId: args.userId,
    }),
  ]);

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  if (windowsError) {
    throw new Error(windowsError.message);
  }

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  const highlineIds = (highlineLinks ?? []).map((link) => link.highline_id);
  const rpcArgs: Database["public"]["Functions"]["get_highline"]["Args"] = {
    searchid: highlineIds,
    ...(args.userId ? { userid: args.userId } : {}),
  };

  const [
    { data: highlines, error: highlinesError },
    { data: highlineRows, error: rowsError },
  ] = await Promise.all([
    highlineIds.length > 0
      ? args.supabase.rpc("get_highline", rpcArgs)
      : Promise.resolve({ data: [], error: null }),
    highlineIds.length > 0
      ? args.supabase.from("highline").select("id, sector_id").in("id", highlineIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (highlinesError) {
    throw new Error(highlinesError.message);
  }

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  const sectorIds = Array.from(
    new Set(
      (highlineRows ?? [])
        .map((row) => row.sector_id)
        .filter((sectorId): sectorId is number => sectorId !== null),
    ),
  );

  const { data: sectors, error: sectorsError } =
    sectorIds.length > 0
      ? await args.supabase
          .from("sector")
          .select("id, name, description")
          .in("id", sectorIds)
      : { data: [] as Sector[], error: null };

  if (sectorsError) {
    throw new Error(sectorsError.message);
  }

  const cards = buildFestivalScheduleCards({
    highlines: highlines ?? [],
    links: (highlineLinks ?? []).map(
      (link): FestivalHighlineLink => ({
        festivalId: link.festival_id,
        highlineId: link.highline_id,
        sortOrder: link.sort_order,
        slotDurationMinutes: link.slot_duration_minutes,
      }),
    ),
    sectors: sectors ?? [],
    windows: windows ?? [],
    slots: slots ?? [],
    bookings: bookings ?? [],
    timeZone: festival.timezone,
    viewer,
  });

  return {
    festival: {
      id: festival.id,
      slug: festival.slug,
      name: festival.name,
      subtitle: festival.subtitle,
      start_at: festival.start_at,
      end_at: festival.end_at,
      timezone: festival.timezone,
    },
    highlineIds,
    sectors: groupFestivalCardsBySector(cards),
    viewer,
  };
}

export async function bookFestivalScheduleSlot(args: {
  input: BookFestivalScheduleSlotInput;
  supabase: TypedSupabaseClient;
}): Promise<BookFestivalScheduleSlotResult> {
  try {
    const { data: booking, error } = await args.supabase.rpc(
      "book_festival_schedule_slot",
      {
        target_slot_id: args.input.slotId,
        target_profile_id: args.input.profileId ?? undefined,
        target_instagram_username: args.input.instagramUsername ?? undefined,
        target_display_name: args.input.displayName ?? undefined,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      booking,
    };
  } catch (error) {
    console.warn("bookFestivalScheduleSlot failed");
    return {
      success: false,
      error: mapFestivalScheduleBookingError(
        error instanceof Error ? error.message : undefined,
      ),
    };
  }
}

export async function cancelFestivalScheduleBooking(args: {
  input: CancelFestivalScheduleBookingInput;
  supabase: TypedSupabaseClient;
}): Promise<CancelFestivalScheduleBookingResult> {
  try {
    const { data: booking, error } = await args.supabase.rpc(
      "cancel_festival_schedule_booking",
      {
        target_booking_id: args.input.bookingId,
        cancellation_reason_input: args.input.reason,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      booking,
    };
  } catch (error) {
    console.warn("cancelFestivalScheduleBooking failed");
    return {
      success: false,
      error: FESTIVAL_SCHEDULE_MUTATION_ERROR,
    };
  }
}
