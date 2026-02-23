import type { Database } from '@chooselife/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NewsSupabaseClient = SupabaseClient<Database>;

export const NEWS_BY_ORGANIZATION_SELECT =
  '*, organizations(slug), news_reactions(reaction), comments_count:news_comments(count)' as const;
export const NEWS_ITEM_BY_SLUG_SELECT =
  '*, organizations(slug), comments:news_comments(*, user:profiles(*))' as const;
export const NEWS_SLUGS_SELECT = 'slug' as const;

export const getNewsByOrganizationQuery = (
  client: NewsSupabaseClient,
  organizationId: string,
) =>
  client
    .from('news')
    .select(NEWS_BY_ORGANIZATION_SELECT)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

export const getNewsItemBySlugQuery = (
  client: NewsSupabaseClient,
  slug: string,
) =>
  client
    .from('news')
    .select(NEWS_ITEM_BY_SLUG_SELECT)
    .eq('slug', slug)
    .single();

export const getNewsSlugsQuery = (
  client: NewsSupabaseClient,
  limit = 100,
) =>
  client
    .from('news')
    .select(NEWS_SLUGS_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
