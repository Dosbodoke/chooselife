import type { TypedSupabaseClient } from "../../supabase-provider";

import type { Database, Tables } from "@chooselife/database";

import {
  buildFestivalHighlineQueueCards,
  groupFestivalCardsBySector,
} from "./selectors";
import type {
  AddFestivalQueueManualEntryInput,
  AddFestivalQueueManualEntryResult,
  FestivalHighlineLink,
  FestivalQueuePageData,
  JoinFestivalQueueInput,
  JoinFestivalQueueResult,
  LeaveFestivalQueueInput,
  LeaveFestivalQueueResult,
  CallNextFestivalQueueInput,
  CallNextFestivalQueueResult,
  RemoveFestivalQueueEntryInput,
  RemoveFestivalQueueEntryResult,
} from "./types";

type Festival = Tables<"festival">;
type Profile = Pick<Tables<"profiles">, "name" | "username">;
type Sector = Pick<Tables<"sector">, "id" | "name" | "description">;

function normalizeQueueName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getFallbackDisplayName(profile: Profile | null) {
  const name = profile?.name?.trim();
  if (name) return name;

  const username = profile?.username?.trim();
  if (username) return username;

  return "";
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
    .select("name, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return profile as Profile | null;
}

async function isFestivalStaff(
  supabase: TypedSupabaseClient,
  festivalId: string,
  userId: string | undefined,
) {
  if (!userId) return false;

  const { data, error } = await supabase
    .from("festival_staff")
    .select("profile_id")
    .eq("festival_id", festivalId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return !!data;
}

export async function getFestivalQueuePageData(args: {
  festivalSlug: string;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<FestivalQueuePageData> {
  const festival = await requireFestivalBySlug(args.supabase, args.festivalSlug);

  const [
    { data: highlineLinks, error: linksError },
    { data: queueEntries, error: queueError },
    profile,
    staffMembership,
  ] = await Promise.all([
    args.supabase
      .from("festival_highline")
      .select("festival_id, highline_id, sort_order")
      .eq("festival_id", festival.id)
      .order("sort_order", { ascending: true }),
    args.supabase
      .from("festival_queue_entry")
      .select("*")
      .eq("festival_id", festival.id)
      .in("status", ["waiting", "called"])
      .order("joined_at", { ascending: true }),
    getViewerProfile(args.supabase, args.userId),
    args.userId
      ? args.supabase
          .from("festival_staff")
          .select("profile_id")
          .eq("festival_id", festival.id)
          .eq("profile_id", args.userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (queueError) {
    throw new Error(queueError.message);
  }

  if (staffMembership.error) {
    throw new Error(staffMembership.error.message);
  }

  const highlineIds = (highlineLinks ?? []).map((link) => link.highline_id);
  const rpcArgs: Database["public"]["Functions"]["get_highline"]["Args"] = {
    searchid: highlineIds,
    ...(args.userId ? { userid: args.userId } : {}),
  };

  const [{ data: highlines, error: highlinesError }, { data: highlineRows, error: rowsError }] =
    await Promise.all([
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

  const cards = buildFestivalHighlineQueueCards({
    highlines: highlines ?? [],
    links: (highlineLinks ?? []).map(
      (link): FestivalHighlineLink => ({
        festivalId: link.festival_id,
        highlineId: link.highline_id,
        sortOrder: link.sort_order,
      }),
    ),
    sectors: sectors ?? [],
    queueEntries: queueEntries ?? [],
    viewerId: args.userId,
  });

  return {
    festival: {
      id: festival.id,
      slug: festival.slug,
      name: festival.name,
      subtitle: festival.subtitle,
      start_at: festival.start_at,
      end_at: festival.end_at,
    },
    highlineIds,
    sectors: groupFestivalCardsBySector(cards),
    viewer: {
      userId: args.userId,
      displayName: getFallbackDisplayName(profile),
      canManage: !!staffMembership.data,
    },
  };
}

export async function joinFestivalQueue(args: {
  input: JoinFestivalQueueInput;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<JoinFestivalQueueResult> {
  try {
    if (!args.userId) {
      return {
        success: false,
        error: "You must be signed in to join the queue",
      };
    }

    const festival = await requireFestivalBySlug(args.supabase, args.input.festivalSlug);
    const normalizedName = normalizeQueueName(args.input.displayName);

    if (!normalizedName) {
      return {
        success: false,
        error: "Name is required to join the queue",
      };
    }

    if (normalizedName.length > 80) {
      return {
        success: false,
        error: "Name is too long",
      };
    }

    const { data: entry, error } = await args.supabase
      .from("festival_queue_entry")
      .insert({
        festival_id: festival.id,
        highline_id: args.input.highlineId,
        profile_id: args.userId,
        display_name: normalizedName,
        status: "waiting",
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "You are already in this queue",
        };
      }

      throw new Error(error.message);
    }

    return {
      success: true,
      entry,
    };
  } catch (error) {
    console.error("joinFestivalQueue failed", error);
    return {
      success: false,
      error: "Could not join the queue",
    };
  }
}

export async function addFestivalQueueManualEntry(args: {
  input: AddFestivalQueueManualEntryInput;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<AddFestivalQueueManualEntryResult> {
  try {
    if (!args.userId) {
      return {
        success: false,
        error: "You must be signed in to manage the queue",
      };
    }

    const festival = await requireFestivalBySlug(
      args.supabase,
      args.input.festivalSlug,
    );
    const normalizedName = normalizeQueueName(args.input.displayName);

    if (!normalizedName) {
      return {
        success: false,
        error: "Name is required to join the queue",
      };
    }

    if (normalizedName.length > 80) {
      return {
        success: false,
        error: "Name is too long",
      };
    }

    const canManage = await isFestivalStaff(args.supabase, festival.id, args.userId);
    if (!canManage) {
      return {
        success: false,
        error: "You must be festival staff to add manual queue entries",
      };
    }

    const { data: entry, error } = await args.supabase
      .from("festival_queue_entry")
      .insert({
        festival_id: festival.id,
        highline_id: args.input.highlineId,
        profile_id: null,
        display_name: normalizedName,
        status: "waiting",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      entry,
    };
  } catch (error) {
    console.error("addFestivalQueueManualEntry failed", error);
    return {
      success: false,
      error: "Could not add the queue entry",
    };
  }
}

export async function leaveFestivalQueue(args: {
  input: LeaveFestivalQueueInput;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<LeaveFestivalQueueResult> {
  try {
    if (!args.userId) {
      return {
        success: false,
        error: "You must be signed in to leave the queue",
      };
    }

    const { data: entry, error } = await args.supabase
      .from("festival_queue_entry")
      .update({
        status: "removed",
        removed_at: new Date().toISOString(),
        removed_by: args.userId,
      })
      .eq("id", args.input.entryId)
      .eq("profile_id", args.userId)
      .in("status", ["waiting", "called"])
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!entry) {
      return {
        success: false,
        error: "Queue entry not found",
      };
    }

    return {
      success: true,
      entry,
    };
  } catch (error) {
    console.error("leaveFestivalQueue failed", error);
    return {
      success: false,
      error: "Could not leave the queue",
    };
  }
}

export async function callNextFestivalQueue(args: {
  input: CallNextFestivalQueueInput;
  supabase: TypedSupabaseClient;
}): Promise<CallNextFestivalQueueResult> {
  try {
    const { data: entry, error } = await args.supabase.rpc(
      "call_next_festival_queue",
      {
        festival_slug: args.input.festivalSlug,
        target_highline_id: args.input.highlineId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      entry,
    };
  } catch (error) {
    console.error("callNextFestivalQueue failed", error);
    return {
      success: false,
      error: "Could not advance the queue",
    };
  }
}

export async function removeFestivalQueueEntry(args: {
  input: RemoveFestivalQueueEntryInput;
  supabase: TypedSupabaseClient;
  userId?: string;
}): Promise<RemoveFestivalQueueEntryResult> {
  try {
    if (!args.userId) {
      return {
        success: false,
        error: "You must be signed in to manage the queue",
      };
    }

    const { data: entry, error } = await args.supabase
      .from("festival_queue_entry")
      .update({
        status: "removed",
        removed_at: new Date().toISOString(),
        removed_by: args.userId,
      })
      .eq("id", args.input.entryId)
      .in("status", ["waiting", "called"])
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!entry) {
      return {
        success: false,
        error: "Queue entry not found",
      };
    }

    return {
      success: true,
      entry,
    };
  } catch (error) {
    console.error("removeFestivalQueueEntry failed", error);
    return {
      success: false,
      error: "Could not remove the queue entry",
    };
  }
}
