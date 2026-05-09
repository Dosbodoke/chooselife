import { QueryData } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from './keys';
import { useSupabase, TypedSupabaseClient } from '../../supabase-provider';

const getNewsQuery = (client: TypedSupabaseClient, organizationId: string) =>
  client
    .from('news')
    .select(
      '*, organizations(slug), news_reactions(user_id, reaction), comments_count:news_comments(count)',
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

type NewsQueryData = QueryData<ReturnType<typeof getNewsQuery>>;

export type News = (NewsQueryData[number] & {
  organizations: { slug: string } | null;
  has_liked: boolean;
})[];

export const useNews = (organizationId: string) => {
  const { supabase, userId } = useSupabase();

  return useQuery<News, Error>({
    queryKey: queryKeys.news.byOrg(organizationId),
    queryFn: async () => {
      const { data, error } = await getNewsQuery(supabase, organizationId);

      if (error) {
        throw new Error(error.message);
      }

      return data.map((news) => ({
        ...news,
        has_liked:
          news.news_reactions?.some(
            (reaction) =>
              reaction.user_id === userId &&
              reaction.reaction === 'thumbsUp',
          ) ?? false,
      }));
    },
  });
};

export const useMutateReaction = (newsId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: async (reaction: string) => {
      if (!userId) {
        throw new Error('User ID is missing');
      }

      const currentReaction = queryClient
        .getQueryData<News>(queryKeys.news.byOrg(organizationId))
        ?.find((news) => news.id === newsId)
        ?.news_reactions?.find(
          (item) => item.user_id === userId && item.reaction === reaction,
        );

      if (currentReaction) {
        const { error } = await supabase.from('news_reactions').delete().match({
          news_id: newsId,
          user_id: userId,
          reaction,
        });

        if (error) throw new Error(error.message);

        return;
      }

      const { error } = await supabase.from('news_reactions').insert({
        news_id: newsId,
        user_id: userId,
        reaction,
      });

      if (error) throw new Error(error.message);
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
  const { supabase, userId } = useSupabase();

  return useMutation({
    mutationFn: async (comment: string) => {
      if (!newsId) throw new Error('News ID is missing');
      if (!userId) throw new Error('User ID is missing');

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
