"use client";

import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../../supabase-provider";
import { fetchRigSetupById, fetchRigSetups } from "./api";
import { rigSetupKeyFactory } from "./keys";

/**
 * Fetch saved rig setup data
 * This query fetches the rig setup rows for this highline along with their related webbing rows,
 * newest rig date first.
 */
export const useRigSetup = ({ highlineID }: { highlineID: string }) => {
  const { supabase } = useSupabase();

  const query = useQuery({
    queryKey: rigSetupKeyFactory.all({ highlineID }),
    queryFn: () => fetchRigSetups(supabase, highlineID),
    enabled: !!highlineID,
  });

  const latestSetup =
    query.data && query.data.length > 0 ? query.data[0] : null;

  return { query, latestSetup };
};

/**
 * Hook to fetch a single rig setup by its primary key (`id`).
 */
export const useRigSetupById = ({
  highlineID,
  rigSetupID,
}: {
  highlineID: string;
  rigSetupID: string;
}) => {
  const { supabase } = useSupabase();

  return useQuery({
    queryKey: rigSetupKeyFactory.single({ rigSetupID, highlineID }),
    queryFn: () =>
      rigSetupID ? fetchRigSetupById(supabase, rigSetupID) : null,
    enabled: !!rigSetupID,
  });
};
