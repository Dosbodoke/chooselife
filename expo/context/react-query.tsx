import NetInfo, {
  useNetInfo,
  type NetInfoState,
} from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  MutationCache,
  onlineManager,
  QueryClient,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  classifySubmissionError,
  isTerminalSubmissionFailure,
  submitHighlineRegistrationMutationKey,
} from '~/features/highline-registration/submission';
import {
  acknowledgeHighlineSubmission,
  isHighlineSubmissionMutation,
  markHighlineSubmissionAttempt,
  markHighlineSubmissionNeedsAttention,
  replayPendingHighlineSubmissions,
  submissionVariablesFromMutation,
} from '~/features/highline-registration/submission-queue';
import { submitHighlineRegistrationOnline } from '~/features/highline-registration/submission-runtime';
import {
  invalidateHighlineWalkLeaderboards,
  registerHighlineWalk,
  registerHighlineWalkMutationKey,
  type RegisterHighlineWalkVariables,
} from '~/features/highline/register-walk';
import AsyncStorage from 'expo-sqlite/kv-store';
import React from 'react';

import { highlineKeyFactory } from '~/hooks/use-highline';
import { useMountEffect } from '~/hooks/use-mount-effect';
import { supabase } from '~/lib/supabase';

// Flip this to true in development to simulate the app being offline.
export const FORCE_OFFLINE = __DEV__ && false;
const PERSISTED_CACHE_BUSTER = 'offline-cache-v2';

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onMutate: (_variables, mutation) => {
      if (!isHighlineSubmissionMutation(mutation)) return;
      const variables = submissionVariablesFromMutation(mutation);
      if (variables) void markHighlineSubmissionAttempt(variables);
    },
    onSuccess: async (_data, _variables, _onMutateResult, mutation) => {
      if (!isHighlineSubmissionMutation(mutation)) return;
      const variables = submissionVariablesFromMutation(mutation);
      if (!variables) return;

      await acknowledgeHighlineSubmission(variables);
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.list(variables.ownerId),
      });
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.detail(
          variables.highlineId,
          variables.ownerId,
        ),
      });
    },
    onError: async (error, _variables, _onMutateResult, mutation) => {
      if (!isHighlineSubmissionMutation(mutation)) return;
      const variables = submissionVariablesFromMutation(mutation);
      if (variables) {
        await markHighlineSubmissionNeedsAttention(
          variables,
          error,
          isTerminalSubmissionFailure(error, mutation.state.failureCount),
        );
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // Refetch when user comes back online
    },
  },
});

queryClient.setMutationDefaults<unknown, Error, RegisterHighlineWalkVariables>(
  registerHighlineWalkMutationKey,
  {
    mutationFn: registerHighlineWalk,
    meta: {
      persistOfflineMutation: true,
    },
    networkMode: 'offlineFirst',
    onSuccess: (_data, variables) => {
      invalidateHighlineWalkLeaderboards(queryClient, variables.highlineId);
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
);

queryClient.setMutationDefaults(submitHighlineRegistrationMutationKey, {
  mutationFn: submitHighlineRegistrationOnline,
  meta: {
    persistOfflineMutation: true,
  },
  networkMode: 'offlineFirst',
  retry: (failureCount, error) => {
    const classified = classifySubmissionError(error);
    return classified.retryable && failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 3000,
});

export function useOnlineStatus() {
  const { isConnected } = useNetInfo();

  return FORCE_OFFLINE ? false : isConnected !== false;
}

export const ReactQueryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useMountEffect(() => {
    const updateOnlineState = (state: NetInfoState) => {
      onlineManager.setOnline(
        FORCE_OFFLINE ? false : state.isConnected !== false,
      );
    };

    const unsubscribeNetInfo = NetInfo.addEventListener(updateOnlineState);
    void NetInfo.fetch().then(updateOnlineState);

    const replayForCurrentSession = async () => {
      const { data } = await supabase.auth.getSession();
      const ownerId = data.session?.user.id;
      if (ownerId) {
        await replayPendingHighlineSubmissions(queryClient, ownerId);
      }
    };

    void replayForCurrentSession();
    const unsubscribeOnline = onlineManager.subscribe((isOnline) => {
      if (isOnline) void replayForCurrentSession();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id) {
        void replayPendingHighlineSubmissions(queryClient, session.user.id);
      }
    });

    return () => {
      unsubscribeNetInfo();
      unsubscribeOnline();
      subscription.unsubscribe();
    };
  });

  return (
    <PersistQueryClientProvider
      persistOptions={{
        buster: PERSISTED_CACHE_BUSTER,
        persister,
        maxAge: Infinity,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutation) =>
            mutation.state.status === 'pending' &&
            mutation.meta?.persistOfflineMutation === true,
          shouldDehydrateQuery: (query) => query.meta?.persistOffline === true,
        },
      }}
      client={queryClient}
      onSuccess={() => {
        void queryClient
          .resumePausedMutations()
          .then(() => queryClient.invalidateQueries())
          .then(() => {
            void (async () => {
              const { data } = await supabase.auth.getSession();
              const ownerId = data.session?.user.id;
              if (ownerId) {
                await replayPendingHighlineSubmissions(queryClient, ownerId);
              }
            })();
          });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
