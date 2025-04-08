import { QueryData } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';

export type RigStatuses = 'rigged' | 'planned' | 'unrigged';

// Create a temporary query builder instance JUST for type inference.
const rigSetupSelectStatement = `
    *,
    rig_setup_webbing (
      *,
      webbing_id ( 
        *,
        model ( * )
      )
    )
`;
// eslint-disable-next-line
const _setupQueryForTypeInference = supabase
  .from('rig_setup')
  .select(rigSetupSelectStatement);
export type Setup = QueryData<typeof _setupQueryForTypeInference>;

export const rigSetupKeyFactory = {
  all: ({ highlineID }: { highlineID: string }) =>
    ['highline', highlineID, 'rigSetup'] as const,
  single: ({
    highlineID,
    rigSetupID,
  }: {
    highlineID: string;
    rigSetupID: string;
  }) => ['highline', highlineID, 'rigSetup', rigSetupID] as const,
};

/**
 * Fetch saved rig setup data
 * This query fetches the rig setup rows for this highline along with their related webbing rows.
 *
 * @param {string} highlineID
 */
export const useRigSetup = ({ highlineID }: { highlineID: string }) => {
  const query = useQuery({
    queryKey: rigSetupKeyFactory.all({ highlineID }),
    queryFn: async (): Promise<Setup> => {
      const { data, error } = await supabase
        .from('rig_setup')
        .select(rigSetupSelectStatement)
        .eq('highline_id', highlineID)
        .order('rig_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!highlineID,
  });

  // query.data is now correctly typed as Setup[] | undefined
  const latestSetup =
    query.data && query.data.length > 0 ? query.data[0] : null;

  // Return the original query object spread, plus the calculated latestSetup
  return { query, latestSetup };
};

/**
 * Hook to fetch a single rig setup by its primary key (`id`).
 *
 * @param rigSetupID - the primary key of the rig_setup row
 */
export const useRigSetupById = ({
  highlineID,
  rigSetupID,
}: {
  highlineID: string;
  rigSetupID: string;
}) => {
  return useQuery({
    queryKey: rigSetupKeyFactory.single({ rigSetupID, highlineID }),
    queryFn: async (): Promise<Setup[number] | null> => {
      if (!rigSetupID) return null;

      const { data, error } = await supabase
        .from('rig_setup')
        .select(rigSetupSelectStatement)
        .eq('id', +rigSetupID)
        .single();

      // Handle specific error from .single() when no row is found
      if (error) {
        if (error.code === 'PGRST116') {
          // "JSON object requested, multiple (or no) rows returned"
          console.warn(
            `No single rig setup found for ID ${rigSetupID}. Returning null.`,
            error.message,
          );
          return null;
        }
        throw error;
      }
      return data;
    },
    enabled: !!rigSetupID,
  });
};
