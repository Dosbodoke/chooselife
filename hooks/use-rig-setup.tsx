import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';

/**
 * Fetch saved rig setup data
 * This query fetches the rig setup row for this highline along with its related webbing rows.
 *
 * @param {string} highlineID
 */
export const useRigSetup = ({ highlineID }: { highlineID: string }) => {
  return useQuery({
    queryKey: ['rigSetup', highlineID],
    queryFn: async () => {
      // We assume that a relationship exists between rig_setup and rig_setup_webbing
      const { data, error } = await supabase
        .from('rig_setup')
        .select(
          `
                  *,
                  rig_setup_webbing ( *, webbing_id ( *, model ( * ) ) )
              `,
        )
        .eq('highline_id', highlineID)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};
