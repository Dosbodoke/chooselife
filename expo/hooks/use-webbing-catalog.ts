import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWebbingCatalog,
  getCatalogRetryAvailability,
  isCatalogStale,
  shouldLoadCatalogOnOpen,
  webbingCatalogQueryKey,
  webbingCatalogQueryOptions,
} from '~/features/webbing/catalog-client';
import { useEffect, useState } from 'react';

const queryFn = ({ signal }: { signal: AbortSignal }) =>
  fetchWebbingCatalog({ signal });

/**
 * Hosted SlackData catalog, cached in memory only. Nothing fetches at app
 * start or on mount: the picker calls `loadOnOpen` when it first opens, and
 * every later request is an explicit `retry`, which honors any cooldown.
 */
export function useWebbingCatalog() {
  const queryClient = useQueryClient();
  const query = useQuery({ ...webbingCatalogQueryOptions, queryFn });
  const now = useCooldownClock(query.error, query.errorUpdatedAt);

  const loadOnOpen = () => {
    if (
      shouldLoadCatalogOnOpen(queryClient.getQueryState(webbingCatalogQueryKey))
    ) {
      void query.refetch();
    }
  };

  const { canRetry, retryAt } = getCatalogRetryAvailability(
    query.error,
    query.errorUpdatedAt,
    now,
  );

  const retry = () => {
    if (query.isFetching) return;
    const state = queryClient.getQueryState(webbingCatalogQueryKey);
    const latest = getCatalogRetryAvailability(
      state?.error,
      state?.errorUpdatedAt ?? 0,
      Date.now(),
    );
    if (latest.canRetry) void query.refetch();
  };

  return {
    ...query,
    loadOnOpen,
    retry,
    canRetry,
    retryAt,
    isStale: isCatalogStale(query.dataUpdatedAt, Date.now()),
  };
}

/** Re-render once a rate-limit cooldown ends so Retry re-enables itself. */
function useCooldownClock(error: unknown, errorUpdatedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  const { retryAt } = getCatalogRetryAvailability(error, errorUpdatedAt, now);

  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      retryAt - Date.now() + 50,
    );
    return () => clearTimeout(timer);
  }, [retryAt]);

  return now;
}
