import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchWebbingCatalog,
  getCatalogRetryAt,
  getCatalogRetryAvailability,
  shouldLoadCatalogOnOpen,
  webbingCatalogQueryKey,
  webbingCatalogQueryOptions,
} from '~/features/webbing/catalog-client';

const queryFn = ({ signal }: { signal: AbortSignal }) =>
  fetchWebbingCatalog({ signal });

/**
 * Hosted SlackData catalog, cached in memory only. Nothing fetches at app
 * start or on mount: the picker calls `loadOnOpen` when it first opens, and
 * every later request is an explicit `retry`, which honors any cooldown.
 *
 * `retryAt` is the cooldown the last failure asked for, even once it has
 * passed; comparing it with the clock is left to the UI showing it.
 */
export function useWebbingCatalog() {
  const queryClient = useQueryClient();
  const query = useQuery({ ...webbingCatalogQueryOptions, queryFn });

  const loadOnOpen = () => {
    if (
      shouldLoadCatalogOnOpen(queryClient.getQueryState(webbingCatalogQueryKey))
    ) {
      void query.refetch();
    }
  };

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
    retryAt: getCatalogRetryAt(query.error, query.errorUpdatedAt),
  };
}

export type WebbingCatalog = ReturnType<typeof useWebbingCatalog>;
