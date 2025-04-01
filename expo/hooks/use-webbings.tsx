import { QueryData } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

// Include rig setup info in the query so that we can compute if the webbing is used.
// Note: adjust the selected columns as needed.
const supabaseQuery = supabase.from('webbing').select(
  `*, 
     model (*),
     rig_setup_webbing (
       id,
       setup_id,
       webbing_id,
       rig_setup (
         unrigged_at
       )
     )`,
);

// Type for the raw data returned from Supabase.
export type WebbingWithModel = QueryData<typeof supabaseQuery>;

// Extend the raw type with our computed property.
export type WebbingWithUsage = WebbingWithModel[number] & {
  isUsed: boolean;
};

// Query keys factory with explicit types.
export const queryKeys = {
  webbings: (): readonly ['webbings'] => ['webbings'],
  webbing: (id: number): readonly ['webbings', number] => [
    ...queryKeys.webbings(),
    id,
  ],
};

// Hook to fetch all user webbings along with their usage info.
export const useUserWebbings = () => {
  const { profile } = useAuth();
  return useQuery<WebbingWithUsage[]>({
    queryKey: queryKeys.webbings(),
    queryFn: async () => {
      // If user is logged out return an empty array meaning there is no webbing
      if (!profile || !profile.id) {
        return [];
      }
      const response = await supabaseQuery.eq('user_id', profile.id);
      if (response.error) {
        throw new Error(response.error.message);
      }
      const data = response.data;
      // For each webbing, check its rig_setup_webbing array.
      // If any of those entries reference a rig_setup with unrigged_at === null,
      // we mark this webbing as in use.
      const transformedData: WebbingWithUsage[] = data.map((webbing) => {
        const isUsed = Array.isArray(webbing.rig_setup_webbing)
          ? webbing.rig_setup_webbing.some(
              (rsw) => rsw.rig_setup && rsw.rig_setup.unrigged_at === null,
            )
          : false;
        return {
          ...webbing,
          isUsed,
        };
      });
      return transformedData;
    },
  });
};

// Hook to fetch a specific webbing by id, including its usage flag.
// This hook first attempts to retrieve the webbing from the cache.
export const useWebbing = (id: number) => {
  const queryClient = useQueryClient();

  return useQuery<WebbingWithUsage | null>({
    queryKey: queryKeys.webbing(id),
    queryFn: async () => {
      // Try to find the webbing in the cached array of webbings.
      const cachedWebbings = queryClient.getQueryData<WebbingWithUsage[]>(
        queryKeys.webbings(),
      );
      if (cachedWebbings) {
        const found = cachedWebbings.find((w) => w.id === id);
        if (found) return found;
      }
      // If not found in cache, fetch directly from Supabase.
      const response = await supabaseQuery.eq('id', id).maybeSingle();
      if (response.error) {
        throw new Error(response.error.message);
      }
      const rawData = response.data as WebbingWithModel[number];
      const isUsed = Array.isArray(rawData.rig_setup_webbing)
        ? rawData.rig_setup_webbing.some(
            (rsw) => rsw.rig_setup && rsw.rig_setup.unrigged_at === null,
          )
        : false;
      return { ...rawData, isUsed };
    },
    // Use the cached webbing as initial data if available.
    initialData: () => {
      const cachedWebbings = queryClient.getQueryData<WebbingWithUsage[]>(
        queryKeys.webbings(),
      );
      if (cachedWebbings) {
        return cachedWebbings.find((w) => w.id === id);
      }
      return undefined;
    },
  });
};
