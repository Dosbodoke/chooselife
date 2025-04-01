import { QueryData } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';

export type RigStatuses = 'rigged' | 'planned' | 'unrigged';

const setupQuery = supabase.from('rig_setup').select(`
    *,
    rig_setup_webbing (
      *,
      webbing_id ( 
        *,
        model ( * )
      )
    )
`);
export type Setup = QueryData<typeof setupQuery>;

/**
 * Define our query key factories. This pattern ensures that query keys are
 * consistently defined across the codebase.
 */
export const queryKeys = {
  all: (highlineID: string) => ['highline', highlineID, 'rigSetup'] as const,
  single: (rigSetupId?: string) =>
    ['highline', 'rigSetup', rigSetupId] as const,
};

/**
 * Fetch saved rig setup data
 * This query fetches the rig setup row for this highline along with its related webbing rows.
 *
 * @param {string} highlineID
 */
export const useRigSetup = ({ highlineID }: { highlineID: string }) => {
  const query = useQuery({
    queryKey: queryKeys.all(highlineID),
    queryFn: async () => {
      // We assume that a relationship exists between rig_setup and rig_setup_webbing
      const { data, error } = await setupQuery
        .eq('highline_id', highlineID)
        .order('rig_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const latestSetup =
    query.data && query.data.length > 0 ? query.data[0] : null;

  return { ...query, latestSetup };
};

/**
 * Hook to fetch a single rig setup by its primary key (`id`).
 *
 * Notice that here we use the `rigSetupDetail` query key factory and we add
 * `.single()` to ensure we get a single row.
 *
 * @param rigSetupId - the primary key of the rig_setup row
 */
export const useRigSetupById = (rigSetupId?: string) => {
  return useQuery({
    queryKey: queryKeys.single(rigSetupId),
    queryFn: async () => {
      if (!rigSetupId) return;
      const { data, error } = await setupQuery.eq('id', +rigSetupId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!rigSetupId,
  });
};
