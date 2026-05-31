import { useNetInfo } from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import {
  PersistQueryClientProvider,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';
import AsyncStorage from 'expo-sqlite/kv-store';
import React from 'react';

// Flip this to true in development to simulate the app being offline.
export const FORCE_OFFLINE = __DEV__ && false;

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

function isUserId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function hasViewerId(value: unknown): value is { viewerId: unknown } {
  return typeof value === 'object' && value !== null && 'viewerId' in value;
}

function isInactiveViewerQuery(
  queryKey: readonly unknown[],
  activeUserId: string | null,
) {
  const [root, second, third, fourth] = queryKey;

  if (root === 'festival') {
    if (!hasViewerId(third)) {
      return true;
    }

    return third.viewerId !== null && third.viewerId !== activeUserId;
  }

  if (root === 'highlines') {
    return (
      !hasViewerId(second) ||
      (second.viewerId !== null && second.viewerId !== activeUserId)
    );
  }

  if (root === 'highline' && third === 'detail') {
    return (
      !hasViewerId(fourth) ||
      (fourth.viewerId !== null && fourth.viewerId !== activeUserId)
    );
  }

  if (root === 'highline' && third === 'favorite') {
    return (
      !hasViewerId(fourth) ||
      (fourth.viewerId !== null && fourth.viewerId !== activeUserId)
    );
  }

  if (root === 'webbings') {
    return (
      !hasViewerId(third) ||
      (third.viewerId !== null && third.viewerId !== activeUserId)
    );
  }

  if (root === 'webbing-history' || root === 'webbing-usage') {
    return (
      !hasViewerId(second) ||
      (second.viewerId !== null && second.viewerId !== activeUserId)
    );
  }

  if (root === 'profile') {
    return isUserId(second) && second !== activeUserId;
  }

  if (root === 'subscription') {
    return (
      !hasViewerId(second) ||
      (second.viewerId !== null && second.viewerId !== activeUserId)
    );
  }

  if (root === 'organizations' && second === 'isMember') {
    return (
      !hasViewerId(third) ||
      (third.viewerId !== null && third.viewerId !== activeUserId)
    );
  }

  if (root === 'organizations' && third === 'members') {
    return (
      !hasViewerId(fourth) ||
      (fourth.viewerId !== null && fourth.viewerId !== activeUserId)
    );
  }

  if (root === 'news') {
    return (
      !hasViewerId(second) ||
      (second.viewerId !== null && second.viewerId !== activeUserId)
    );
  }

  return false;
}

export async function removeInactiveViewerQueries(activeUserId: string | null) {
  queryClient.removeQueries({
    predicate: (query) => isInactiveViewerQuery(query.queryKey, activeUserId),
  });

  await persistQueryClientSave({
    queryClient,
    persister,
    dehydrateOptions: {
      shouldDehydrateMutation: (mutation) =>
        mutation.state.status === 'pending',
    },
  });
}

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
