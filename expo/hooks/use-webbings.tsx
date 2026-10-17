import { getWebbingDisplayName } from '@chooselife/ui';
import { QueryData } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

// Create a temporary query builder instance JUST for type inference.
const webbingSelectStatement = `*, 
  model (*),
  rig_setup_webbing (
    id,
    setup_id,
    webbing_id,
    rig_setup (
      unrigged_at
    )
  )`;
// eslint-disable-next-line
const _webbingQueryForTypeInference = supabase
  .from('webbing')
  .select(webbingSelectStatement);
// Type for the raw data array possibly returned by Supabase.
export type WebbingWithModel = QueryData<typeof _webbingQueryForTypeInference>;

// Type for a SINGLE raw webbing row. Extract from the array type.
type SingleWebbingWithModel = NonNullable<WebbingWithModel>[number];

// Extend the SINGLE raw type with our computed 'isUsed' property.
export type WebbingWithUsage = SingleWebbingWithModel & {
  isUsed: boolean;
};

// Private inventory: keys and `authScope` carry the viewer so a different
// account never reads this cache. `all()` prefixes every viewer's entries.
export const webbingKeys = {
  all: () => ['webbings'] as const,
  webbings: (viewerId: string | undefined) =>
    [...webbingKeys.all(), viewerId ?? 'anonymous'] as const,
  webbing: (viewerId: string | undefined, id: number) =>
    [...webbingKeys.webbings(viewerId), id] as const,
};

// Helper function to compute 'isUsed' and transform a single webbing object
const transformWebbingData = (
  webbing: SingleWebbingWithModel | null | undefined,
): WebbingWithUsage | null => {
  if (!webbing) {
    return null;
  }
  const isUsed = Array.isArray(webbing.rig_setup_webbing)
    ? webbing.rig_setup_webbing.some(
        (rsw) => rsw.rig_setup && rsw.rig_setup.unrigged_at === null,
      )
    : false;

  return {
    ...webbing,
    isUsed,
  };
};

// Hook to fetch all user webbings along with their usage info.
export const useUserWebbings = () => {
  const { profile } = useAuth();

  return useQuery<WebbingWithUsage[]>({
    queryKey: webbingKeys.webbings(profile?.id),
    meta: { authScope: profile?.id },
    queryFn: async (): Promise<WebbingWithUsage[]> => {
      if (!profile?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('webbing')
        .select(webbingSelectStatement)
        .eq('user_id', profile.id);

      if (error) {
        throw new Error(error.message);
      }

      const rawDataArray = data || [];

      const transformedData: WebbingWithUsage[] = rawDataArray
        .map(transformWebbingData)
        .filter((w): w is WebbingWithUsage => w !== null);

      return transformedData;
    },
    enabled: !!profile?.id,
  });
};

export const useWebbing = (id: number) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useQuery<WebbingWithUsage | null>({
    queryKey: webbingKeys.webbing(profile?.id, id),
    meta: { authScope: profile?.id },
    queryFn: async (): Promise<WebbingWithUsage | null> => {
      const cachedWebbings = queryClient.getQueryData<WebbingWithUsage[]>(
        webbingKeys.webbings(profile?.id),
      );
      if (cachedWebbings) {
        const foundInCache = cachedWebbings.find((w) => w.id === id);
        if (foundInCache) {
          return foundInCache;
        }
      }

      const { data: rawData, error } = await supabase
        .from('webbing')
        .select(webbingSelectStatement)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return transformWebbingData(rawData);
    },
    initialData: () => {
      const cachedWebbings = queryClient.getQueryData<WebbingWithUsage[]>(
        webbingKeys.webbings(profile?.id),
      );
      return cachedWebbings?.find((w) => w.id === id);
    },
    enabled: typeof id === 'number' && !isNaN(id),
  });
};

export const getWebbingName = (
  webbing: Omit<WebbingWithModel[number], 'rig_setup_webbing'> | null,
) => {
  // Label, then saved SlackData name, then legacy model name.
  return (
    getWebbingDisplayName(webbing) ||
    i18next.t('context.rig-form.unknownWebbing')
  );
};
