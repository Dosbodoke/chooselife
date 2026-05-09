import {
  useMutateReaction,
  useNews,
  type News as NewsType,
} from '@chooselife/ui';
import { useRouter } from 'expo-router';
import { MessageSquare, ThumbsUp } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Markdown } from 'react-native-remark';

import { useAuth } from '~/context/auth';

import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

const NewsCardSkeleton = () => {
  return (
    <View className="bg-white rounded-xl p-4 gap-2">
      <Skeleton className="h-7 w-3/4 bg-gray-200" />

      <View className="gap-1 my-2">
        <Skeleton className="h-4 w-full bg-gray-200" />
        <Skeleton className="h-4 w-full bg-gray-200" />
        <Skeleton className="h-4 w-2/3 bg-gray-200" />
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <View className="flex-row gap-4">
          <Skeleton className="h-5 w-10 bg-gray-200" />
          <Skeleton className="h-5 w-10 bg-gray-200" />
        </View>
        <Skeleton className="h-5 w-32 bg-gray-200" />
      </View>
    </View>
  );
};

const NewsCard = ({ news }: { news: NewsType[number] }) => {
  const router = useRouter();
  const { profile } = useAuth();

  const { mutate: react, isPending } = useMutateReaction(
    news.id,
    news.organization_id!,
  );

  const hasLiked = news.has_liked;

  const thumbsUpCount =
    news.news_reactions?.filter((reaction) => reaction.reaction === 'thumbsUp')
      .length ?? 0;

  const commentsCount = news.comments_count?.[0]?.count ?? 0;

  const { previewContent, isClamped } = React.useMemo(() => {
    if (!news.content) return { previewContent: '', isClamped: false };

    const limit = 500;

    if (news.content.length <= limit) {
      return { previewContent: news.content, isClamped: false };
    }

    const end = news.content.indexOf('\n', limit);

    return end !== -1
      ? { previewContent: news.content.slice(0, end), isClamped: true }
      : { previewContent: news.content, isClamped: false };
  }, [news.content]);

  const handleOpenNews = () => {
    router.push(`/news/${news.slug}`);
  };

  const handleReact = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();

    if (isPending) return;
    if (!profile) {
      router.push('/login');
      return;
    }

    react('thumbsUp');
  };

  return (
    <Pressable
      className="bg-white rounded-xl p-4"
      onPress={handleOpenNews}
      accessibilityRole="button"
    >
      <Text className="text-sm text-gray-500 mb-2">
        {new Date(news.created_at).toLocaleDateString()}
      </Text>

      <View className="relative">
        <Markdown markdown={previewContent} />

        {isClamped && (
          <View
            className="absolute inset-x-0 bottom-0 h-40"
            style={{
              experimental_backgroundImage:
                'linear-gradient(to bottom, rgba(255, 255, 255, 0), #ffffff)',
            }}
          />
        )}
      </View>

      <View className="flex-row justify-between items-center mt-8">
        <View className="flex-row items-center gap-4">
          <Pressable
            className="flex-row items-center gap-1"
            onPress={handleReact}
            disabled={isPending}
            hitSlop={8}
          >
            <ThumbsUp
              className="w-4 h-4 text-gray-500"
              fill={hasLiked ? '#3b82f6' : 'transparent'}
            />

            <Text className={hasLiked ? 'text-blue-500' : 'text-gray-500'}>
              {thumbsUpCount}
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-1">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <Text className="text-gray-500">{commentsCount}</Text>
          </View>
        </View>

        <Text className="text-blue-500 font-bold">Participar da discussão</Text>
      </View>
    </Pressable>
  );
};

export const News = ({ organizationId }: { organizationId: string }) => {
  const { data: news, isLoading, isError } = useNews(organizationId);

  if (isLoading) {
    return (
      <View className="gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <NewsCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (isError) {
    return <Text>Erro ao carregar notícias.</Text>;
  }

  return (
    <View className="gap-4">
      {news?.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </View>
  );
};
