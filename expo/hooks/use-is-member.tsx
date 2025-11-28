import { useQuery } from '@tanstack/react-query';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

export const useIsMember = (organizationId: string | undefined) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery<boolean, Error>({
    queryKey: queryKeys.organizations.isMember(organizationId, userId),
    queryFn: async () => {
      if (!organizationId || !userId) {
        return false;
      }

      // Assuming 'organization_members' is the table linking users to organizations
      const { count, error } = await supabase
        .from('organization_members') 
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return (count || 0) > 0;
    },
    enabled: !!organizationId && !!userId,
  });
};
