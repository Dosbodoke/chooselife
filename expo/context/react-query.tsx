import { useNetInfo } from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  invalidateHighlineWalkLeaderboards,
  registerHighlineWalk,
  registerHighlineWalkMutationKey,
  type RegisterHighlineWalkVariables,
} from '~/features/highline/register-walk';
import AsyncStorage from 'expo-sqlite/kv-store';
import React from 'react';

// Flip this to true in development to simulate the app being offline.
export const FORCE_OFFLINE = __DEV__ && false;
const PERSISTED_CACHE_BUSTER = 'offline-cache-v2';

const queryClient = new QueryClient({
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
  const isOnline = useOnlineStatus();

  React.useEffect(() => {
    onlineManager.setOnline(isOnline);
  }, [isOnline]);

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
      onSuccess={() =>
        queryClient
          .resumePausedMutations()
          .then(() => queryClient.invalidateQueries())
      }
    >
      {children}
    </PersistQueryClientProvider>
  );
};
