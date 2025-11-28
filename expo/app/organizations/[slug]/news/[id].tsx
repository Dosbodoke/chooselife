import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Send, ChevronLeft } from 'lucide-react-native';
import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Markdown } from 'react-native-remark';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardControllerView } from 'react-native-keyboard-controller';

import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { useMutateComment, useNewsItem } from '~/hooks/use-news';
import { useIsMember } from '~/hooks/use-is-member';
import { BecomeMember } from '~/components/organizations/BecomeMember';

const NewsDetailSkeleton = () => {
  return (
    <View className="flex-1 p-4 bg-white">
      {/* Title */}
      <Skeleton className="h-8 w-3/4 mb-6 bg-gray-300" />

      {/* Content */}
      <View className="mb-8 gap-2">
        <Skeleton className="h-5 w-full bg-gray-300" />
        <Skeleton className="h-5 w-full bg-gray-300" />
        <Skeleton className="h-5 w-11/12 bg-gray-300" />
        <Skeleton className="h-5 w-4/5 bg-gray-300" />
      </View>

      {/* Comments section title */}
      <View className="border-t border-gray-200 pt-4">
        <Skeleton className="h-6 w-1/3 mb-4 bg-gray-300" />

        {/* Comment Skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className="flex-row gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full bg-gray-300" />
            <View className="flex-1 gap-1">
              <Skeleton className="h-4 w-1/2 bg-gray-300" />
              <Skeleton className="h-5 w-full bg-gray-300" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function NewsDetail() {
  const { id, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const { data: news, isLoading, isError } = useNewsItem(id);
  const { mutate: addComment, isPending: isAddingComment } = useMutateComment(id!);
  const [commentText, setCommentText] = useState('');

  const { data: isMember, isLoading: isMemberLoading } = useIsMember(slug);

  const [bottomPadding, setBottomPadding] = useState(0);
  const becomeMemberRef = useRef<View>(null);

  useLayoutEffect(() => {
    if (isMember) {
      setBottomPadding(0);
      return;
    }

    becomeMemberRef.current?.measureInWindow((_x, _y, _width, height) => {
      setBottomPadding(height);
    });
  }, [isMember, slug]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Discussão',
            headerLeft: ({ tintColor }) => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={20}
              className="ml-1 mt-2"
              style={{ alignItems: "center", "justifyContent": "center" }}
            >
              <ChevronLeft color={tintColor ?? '#000'} size={24} />
            </Pressable>
            ),
          }}
        />
        <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
          <KeyboardControllerView style={{ flex: 1 }}>
            <NewsDetailSkeleton />
          </KeyboardControllerView>
        </SafeAreaView>
      </>
    );
  }

  if (isError || !news) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="text-red-500">Erro ao carregar a discussão.</Text>
      </View>
    );
  }

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment(commentText, {
      onSuccess: () => {
        setCommentText('');
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Discussão',
          headerLeft: ({ tintColor }) => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={20}
              className="ml-1 mt-2"
              style={{ alignItems: "center", "justifyContent": "center" }}
            >
              <ChevronLeft color={tintColor ?? '#000'} size={24} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <KeyboardControllerView 
          style={{ flex: 1 }}
        >
          <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: bottomPadding + 20 }}>
            <Text className="text-sm text-gray-600 mb-2">
              {new Date(news.created_at).toLocaleDateString()}
            </Text>
            <View className="mb-6">
              <Markdown markdown={news.content} />
            </View>

            <View className="border-t border-gray-200 pt-4">
              <Text className="text-lg font-bold mb-4 text-black">
                Comentários ({news.comments?.length || 0})
              </Text>

              <View className="gap-4">
                {news.comments?.map((comment) => (
                  <View key={comment.id} className="flex-row gap-3">
                    <View className="h-10 w-10 rounded-full overflow-hidden">
                      <SupabaseAvatar profileID={comment.user_id ?? undefined} />
                    </View>
                    <View className="flex-1 bg-gray-100 p-3 rounded-lg">
                      <Text className="font-bold text-sm text-black">
                        {comment.user?.username || comment.user?.name || 'Usuário Desconhecido'}
                      </Text>
                      <Text className="mt-1 text-black">{comment.comment}</Text>
                    </View>
                  </View>
                ))}
                {news.comments?.length === 0 && (
                  <Text className="text-gray-500 italic">Nenhum comentário ainda. Seja o primeiro!</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {isMemberLoading ? (
            <View className="p-4 border-t border-gray-200 bg-white">
              <Skeleton className="h-12 w-full bg-gray-300" />
            </View>
          ) : isMember ? (
            <View className="p-4 border-t border-gray-200 flex-row gap-2 items-center bg-white">
              <TextInput
                className="flex-1 bg-gray-100 p-3 rounded-full text-black"
                placeholder="Adicione um comentário..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                placeholderTextColor="#6b7280"
              />
              <Pressable
                onPress={handleAddComment}
                disabled={isAddingComment || !commentText.trim()}
                className={`p-3 rounded-full ${
                  !commentText.trim() ? 'bg-gray-300' : 'bg-blue-500'
                }`}
              >
                {isAddingComment ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Send size={20} color="white" />
                )}
              </Pressable>
            </View>
          ) : (
            <BecomeMember slug={slug} ref={becomeMemberRef} />
          )}
        </KeyboardControllerView>
      </SafeAreaView>
    </>
  );
}
