import { resolveWebbingSpecs, type WebbingSpecsInput } from '@chooselife/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  catalogAssetsQueryKey,
  catalogAssetsQueryOptions,
  fetchCatalogAssets,
  matchCatalogPhotos,
  shouldLoadCatalogAssets,
} from '~/features/webbing/catalog-assets';

import { getR2PublicUrl } from '~/lib/r2';

export const slackDataUrl = (path: string) => getR2PublicUrl('slackdata', path);

const queryFn = ({ signal }: { signal: AbortSignal }) =>
  fetchCatalogAssets({ url: slackDataUrl, signal });

/**
 * Optional catalog photos, loaded alongside the hosted catalog when the
 * picker opens, or on mount for saved catalog webbings. Without assets,
 * cards simply show no photo.
 */
export function useWebbingCatalogAssets({ enabled = false } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...catalogAssetsQueryOptions,
    queryFn,
    enabled,
    refetchOnMount: enabled,
  });

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

/** Resolve optional photos from saved specs, without fetching the live catalog. */
export function useSavedWebbingCatalogPhotos(
  webbings: WebbingSpecsInput[] = [],
) {
  const snapshots = webbings.flatMap((webbing) => {
    const catalog = resolveWebbingSpecs(webbing).catalog;
    return catalog ? [catalog] : [];
  });
  const assets = useWebbingCatalogAssets({ enabled: snapshots.length > 0 });
  return matchCatalogPhotos(assets.data, snapshots, slackDataUrl).uris;
}
