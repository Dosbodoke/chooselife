import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryKeys } from './keys';
import { useOrganizationContext } from './context';

const fetchOrganization = async (supabase: SupabaseClient, slug: string) => {
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
  const { supabase } = useOrganizationContext();
  
  return useQuery({
    queryKey: queryKeys.organizations.bySlug(slug),
    queryFn: () => fetchOrganization(supabase, slug),
    enabled: !!slug,
  });
};
