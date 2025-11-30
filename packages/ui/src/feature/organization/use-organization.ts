import { QueryData } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { type TypedSupabaseClient, useSupabase } from '../../supabase-provider';
import { queryKeys } from './keys';

const getOrganizationQuery = (client: TypedSupabaseClient, slug: string) =>
  client
    .from('organizations')
    .select(
      '*',
    )
    .eq('slug', slug)
    .single();

export type Organization = QueryData<ReturnType<typeof getOrganizationQuery>>;

export const useOrganization = (slug: string) => {
  const { supabase } = useSupabase();

  const query = useQuery<Organization, Error>({
    queryKey: queryKeys.organizations.bySlug(slug),
    queryFn: async () => {
      const { data, error } = await getOrganizationQuery(supabase, slug);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!slug,
  });

  return query
};
