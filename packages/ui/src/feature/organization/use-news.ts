import { QueryData } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from './keys';
import { useOrganizationContext, TypedSupabaseClient } from './context';

const getNewsQuery = (client: TypedSupabaseClient, organizationId: string) =>
  client
    .from('news')
    .select('*, organizations(slug), news_reactions(reaction), comments_count:news_comments(count)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

export type News = (QueryData<ReturnType<typeof getNewsQuery>>[number] & {
  organizations: { slug: string } | null;
})[];

export const useNews = (organizationId: string) => {
  const { supabase } = useOrganizationContext();

  return useQuery<News, Error>({
    queryKey: queryKeys.news.byOrg(organizationId),
    queryFn: async () => {
      const { data, error } = await getNewsQuery(supabase, organizationId);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
};

export const useMutateReaction = (newsId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const { supabase, userId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (reaction: string) => {
      const currentReaction = queryClient
        .getQueryData<News>(queryKeys.news.byOrg(organizationId))
        ?.flatMap((news) => news.news_reactions)
        .find((r) => r.reaction === reaction);

      if (currentReaction) {
        const { error } = await supabase
          .from('news_reactions')
          .delete()
          .match({ news_id: newsId, user_id: userId, reaction });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('news_reactions')
          .insert({ news_id: newsId, user_id: userId, reaction });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.news.byOrg(organizationId),
      });
    },
  });
};

export const useNewsItem = (slug: string) => {
  const { supabase } = useOrganizationContext();

  return useQuery({
    queryKey: queryKeys.newsItem.bySlug(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*, organizations(slug), comments:news_comments(*, user:profiles(*))')
        .eq('slug', slug)
        .single();

        if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!slug,
  });
};

export const useMutateComment = (newsId: string | undefined) => {
  const queryClient = useQueryClient();
  const { supabase, userId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (comment: string) => {
      if (!newsId) throw new Error('News ID is missing');
      const { error } = await supabase
        .from('news_comments')
        .insert({ news_id: newsId, user_id: userId, comment });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.newsItem.all,
      });
    },
  });
};
