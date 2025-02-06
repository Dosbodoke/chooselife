// src/queries/useProfile.ts
import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';
import type { Tables } from '~/utils/database.types';

export type Profile = Tables<'profiles'>;

export const useProfile = (id?: string | null) => {
  return useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
    // Only run this query if a id exists.
    enabled: !!id,
    // Mark the data as always fresh so it will never refetch automatically.
    staleTime: Infinity,
  });
};
