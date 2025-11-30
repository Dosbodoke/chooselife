import { useQuery } from '@tanstack/react-query';

import { queryKeys } from './keys';
import { useSupabase } from '../../supabase-provider';

export const useIsMember = (organizationSlug: string | undefined) => {
  const { supabase, userId } = useSupabase();

  return useQuery({
    queryKey: queryKeys.organizations.isMember(organizationSlug, userId),
    queryFn: async () => {
      if (!userId || !organizationSlug) return false;

      const { data, error } = await supabase
        .from('organization_members')
        .select('*, organizations!inner(slug)')
        .eq('user_id', userId)
        .eq('organizations.slug', organizationSlug)
        .maybeSingle();

      if (error) throw new Error(error.message);

      return !!data;
    },
    enabled: !!userId && !!organizationSlug,
  });
};
