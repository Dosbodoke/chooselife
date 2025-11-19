import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const fetchOrganization = async (slug: string) => {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return data;
};

export const useOrganization = (slug: string) => {
  return useQuery({
    queryKey: queryKeys.organizations.bySlug(slug),
    queryFn: () => fetchOrganization(slug),
    enabled: !!slug,
  });
};
