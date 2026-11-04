import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  catalogAssetsQueryKey,
  catalogAssetsQueryOptions,
  fetchCatalogAssets,
  shouldLoadCatalogAssets,
} from '~/features/webbing/catalog-assets';

import { getR2PublicUrl } from '~/lib/r2';

export const slackDataUrl = (path: string) => getR2PublicUrl('slackdata', path);

const queryFn = ({ signal }: { signal: AbortSignal }) =>
  fetchCatalogAssets({ url: slackDataUrl, signal });

/**
 * Optional catalog photos, loaded alongside the hosted catalog when the
 * picker opens. Errors are never surfaced: without assets, cards simply
 * show no photo.
 */
export function useWebbingCatalogAssets() {
  const queryClient = useQueryClient();
  const query = useQuery({ ...catalogAssetsQueryOptions, queryFn });

  const loadOnOpen = () => {
    if (
      shouldLoadCatalogAssets(
        queryClient.getQueryState(catalogAssetsQueryKey),
        Date.now(),
      )
    ) {
      void query.refetch();
    }
  };

  return { data: query.data, loadOnOpen };
}
