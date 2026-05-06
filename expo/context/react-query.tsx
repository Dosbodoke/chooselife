import { useNetInfo } from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import AsyncStorage from 'expo-sqlite/kv-store';
import React from 'react';

// Flip this to true in development to simulate the app being offline.
export const FORCE_OFFLINE = __DEV__ && true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // Refetch when user comes back online
    },
  },
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
  const isOnline = useOnlineStatus();

  React.useEffect(() => {
    onlineManager.setOnline(isOnline);
  }, [isOnline]);

  return (
    <PersistQueryClientProvider
      persistOptions={{
        persister,
        maxAge: Infinity,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutation) =>
            mutation.state.status === 'pending',
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
