"use client";

import { useQuery } from "@tanstack/react-query";

import type { Tables } from "@chooselife/database";

import { useSupabase } from "../../supabase-provider";
import { rigSetupKeyFactory } from "./keys";

export type RiggerProfile = Pick<
  Tables<"profiles">,
  "id" | "name" | "username" | "profile_picture"
>;

/**
 * Profiles for every rigger across a highline's setups, fetched in one query
 * instead of one per avatar. Returned as a map keyed by profile id.
 */
export function useRiggerProfiles(profileIDs: string[]) {
  const { supabase } = useSupabase();
  const uniqueIDs = [...new Set(profileIDs)];

  return useQuery({
    queryKey: rigSetupKeyFactory.riggers(uniqueIDs),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, username, profile_picture")
        .in("id", uniqueIDs);

      if (error) throw error;
      return new Map<string, RiggerProfile>(
        (data ?? []).map((profile) => [profile.id, profile]),
      );
    },
    enabled: uniqueIDs.length > 0,
    staleTime: 1000 * 60 * 10,
  });
}
