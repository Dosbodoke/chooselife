import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import AsyncStorage from 'expo-sqlite/kv-store';
import React from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 3000,
});

export const ReactQueryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Listen for connectivity changes.
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(!!state.isConnected);
    });
    return unsubscribe;
  }, []);

  return (
    <PersistQueryClientProvider
      persistOptions={{ persister }}
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
