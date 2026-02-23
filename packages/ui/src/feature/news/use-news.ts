import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getNewsByOrganizationQuery,
  getNewsItemBySlugQuery,
} from './queries';
import type { News, NewsItem } from './types';
import { queryKeys } from '../organization/keys';
import { useSupabase } from '../../supabase-provider';

export type { News } from './types';

export const useNews = (organizationId: string) => {
  const { supabase } = useSupabase();

  return useQuery<News, Error>({
    queryKey: queryKeys.news.byOrg(organizationId),
    queryFn: async () => {
      const { data, error } = await getNewsByOrganizationQuery(
        supabase,
        organizationId,
      );

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });
};

export const useMutateReaction = (newsId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

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
  const { supabase } = useSupabase();

  return useQuery<NewsItem, Error>({
    queryKey: queryKeys.newsItem.bySlug(slug),
    queryFn: async () => {
      const { data, error } = await getNewsItemBySlugQuery(supabase, slug);

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!slug,
  });
};

export const useMutateComment = (newsId: string | undefined) => {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

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
