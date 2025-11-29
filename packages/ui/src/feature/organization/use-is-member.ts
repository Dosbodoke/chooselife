import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './keys';
import { useOrganizationContext } from './context';

export const useIsMember = (
  organizationSlug: string | undefined,
) => {
  const { supabase, userId } = useOrganizationContext();

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

      if (error) {
        throw new Error(error.message);
      }

      return (count || 0) > 0;
    },
    enabled: !!organizationSlug && !!userId,
  });
};
