import { useQuery } from '@tanstack/react-query';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

export const useIsMember = (
  organizationSlug: string | undefined,
) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery<boolean, Error>({
    queryKey: queryKeys.organizations.isMember(organizationSlug, userId),
    queryFn: async () => {
      if (!organizationSlug || !userId) {
        return false;
      }

      const { count, error } = await supabase
        .from('organization_members')
        .select('organizations!inner(slug)', { count: 'exact' })
        .eq('user_id', userId)
        .eq('organizations.slug', organizationSlug);

      console.log({ count, error })
      if (error) {
        throw new Error(error.message);
      }

      return (count || 0) > 0;
    },
    enabled: !!organizationSlug && !!userId,
  });
};
