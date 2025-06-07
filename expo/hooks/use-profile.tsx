// src/queries/useProfile.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';
import type { Tables } from '~/utils/database.types';

export type Profile = Tables<'profiles'>;

const profileQueryKeyFactory = {
  id: (id: string) => ['profile', id],
};

export const useProfile = (id: string | null) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileQueryKeyFactory.id(id as string),
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
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });

  const invalidateProfile = () => {
    if (!id) return;
    queryClient.invalidateQueries({
      queryKey: profileQueryKeyFactory.id(id),
    });
  };

  return { invalidateProfile, query };
};
