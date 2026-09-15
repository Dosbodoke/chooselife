import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import {
  CourseAccessError,
  fetchHighlineBeginnerGuideAccess,
} from '~/lib/course-access';

import { CoursePdfViewer } from '~/components/course-pdf-viewer';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

const COURSE_ACCESS_QUERY_KEY = ['course-access', 'highline-beginner'] as const;

export default function LearnScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, sessionLoading } = useAuth();
  const isOnline = useOnlineStatus();
  const userId = session?.user.id;
  const accessToken = session?.access_token;

  const accessQuery = useQuery({
    queryKey: [...COURSE_ACCESS_QUERY_KEY, userId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchHighlineBeginnerGuideAccess(accessToken!, { signal }),
    enabled: Boolean(accessToken && isOnline),
    networkMode: 'online' as const,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always' as const,
    meta: {
      authScope: userId ?? 'public',
    },
  });

  const handleSignIn = React.useCallback(() => {
    router.push({
      pathname: '/(modals)/login',
      params: { redirect_to: '/learn' },
    });
  }, [router]);

  const handleRetry = React.useCallback(() => {
    void accessQuery.refetch();
  }, [accessQuery]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('app.learn.title') }} />

      {sessionLoading ? (
        <LearnState>
          <ActivityIndicator />
          <Text selectable>{t('app.learn.loading')}</Text>
        </LearnState>
      ) : !session ? (
        <LearnState>
          <Text variant="h2" className="border-0 text-center" selectable>
            {t('app.learn.signInTitle')}
          </Text>
          <Text className="text-center text-muted-foreground" selectable>
            {t('app.learn.signInDescription')}
          </Text>
          <Button onPress={handleSignIn}>
            <Text>{t('app.learn.signIn')}</Text>
          </Button>
        </LearnState>
      ) : !isOnline ? (
        <LearnState>
          <Text variant="h2" className="border-0 text-center" selectable>
            {t('app.learn.offlineTitle')}
          </Text>
          <Text className="text-center text-muted-foreground" selectable>
            {t('app.learn.offlineDescription')}
          </Text>
        </LearnState>
      ) : accessQuery.isPending ? (
        <LearnState>
          <ActivityIndicator />
          <Text selectable>{t('app.learn.loading')}</Text>
        </LearnState>
      ) : accessQuery.isError ? (
        accessQuery.error instanceof CourseAccessError &&
        accessQuery.error.status === 403 ? (
          <LearnState>
            <Text variant="h2" className="border-0 text-center" selectable>
              {t('app.learn.lockedTitle')}
            </Text>
            <Text className="text-center text-muted-foreground" selectable>
              {t('app.learn.lockedDescription')}
            </Text>
          </LearnState>
        ) : (
          <LearnState>
            <Text className="text-center" selectable>
              {t('app.learn.error')}
            </Text>
            <Button onPress={handleRetry} variant="outline">
              <Text>{t('app.learn.retry')}</Text>
            </Button>
          </LearnState>
        )
      ) : accessQuery.data ? (
        <CoursePdfViewer
          key={accessQuery.data.pdfUrl}
          uri={accessQuery.data.pdfUrl}
          onRetry={handleRetry}
        />
      ) : (
        <LearnState>
          <Text className="text-center" selectable>
            {t('app.learn.error')}
          </Text>
          <Button onPress={handleRetry} variant="outline">
            <Text>{t('app.learn.retry')}</Text>
          </Button>
        </LearnState>
      )}
    </View>
  );
}

function LearnState({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      {children}
    </View>
  );
}
