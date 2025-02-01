import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';

export const useWebbings = () => {
  return useQuery({
    queryKey: ['webbings'],
    queryFn: async () => {
      const response = await supabase.from('webbing').select(`*, model (*)`);
      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
  });
};
