import { QueryData } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '~/context/auth';
import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

const query = supabase
  .from('news')
  .select('*, news_reactions(reaction), comments_count:news_comments(count)');

export type News = QueryData<typeof query>;

export const useNews = (organizationId: string) => {
  return useQuery<News, Error>({
    queryKey: queryKeys.news.byOrg(organizationId),
    queryFn: async () => {
      const { data, error } = await query
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
};

export const useMutateReaction = (newsId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

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
          .match({ news_id: newsId, user_id: session?.user?.id, reaction });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from('news_reactions')
          .insert({ news_id: newsId, user_id: session?.user?.id, reaction });
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

export const useNewsItem = (newsId: string) => {
  return useQuery({
    queryKey: queryKeys.newsItem.byId(newsId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*, organizations(slug), comments:news_comments(*, user:profiles(*))')
        .eq('id', newsId)
        .single();

        if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!newsId,
  });
};

export const useMutateComment = (newsId: string) => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (comment: string) => {
      const { error } = await supabase
        .from('news_comments')
        .insert({ news_id: newsId, user_id: session?.user?.id, comment });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.newsItem.byId(newsId),
      });
    },
  });
};
