import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { fetchHighlineBeginnerGuideAccess } from '~/lib/course-access';
import { resolveCourseGuideState } from '~/lib/course-guide-state';

import { CourseGuideScreen } from '~/components/course-guide/course-guide-screen';

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

  const handleBack = React.useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const viewState = resolveCourseGuideState({
    accessError: accessQuery.error,
    isAccessPending: accessQuery.isPending,
    isOnline,
    pdfUrl: accessQuery.data?.pdfUrl,
    sessionLoading,
    signedIn: Boolean(session),
  });

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('app.learn.title') }} />
      <CourseGuideScreen
        state={viewState}
        onBack={handleBack}
        onRetry={handleRetry}
        onSignIn={handleSignIn}
      />
    </View>
  );
}
