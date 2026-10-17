import type { WebbingCatalogSnapshot } from '@chooselife/ui';

// Optional product photos from Choose Life's mirror of SlackData's backup
// (scripts/slackdata). The hosted catalog stays authoritative for specs; any
// failure here only means no photos.

/** Total budget for the pointer and index together. */
export const CATALOG_ASSETS_TIMEOUT_MS = 5_000;
export const CATALOG_ASSETS_MAX_CHARS = 2 * 1024 * 1024;
const INDEX_SCHEMA_VERSION = 1;

const POINTER_PATH = 'latest.json';
const INDEX_PATH = /^slackdata\/(releases\/[0-9a-f]{64}\/index\.json)$/;
const MEDIA_KEY =
  /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

export interface CatalogAssetEntry {
  id: number;
  name: string;
  brand: string | null;
  /** First (default) small photo's media key, if any. */
  photo: string | null;
}

export interface CatalogAssets {
  releaseId: string;
  byId: Map<number, CatalogAssetEntry>;
}

/**
 * Builds a public URL for a path inside the `slackdata/` CDN namespace.
 * Callers pass `getR2PublicUrl('slackdata', path)`; the host is never taken
 * from the downloaded data.
 */
export type SlackDataUrl = (path: string) => string;

type FetchImpl = (
  input: string,
  init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export async function fetchCatalogAssets({
  url,
  signal,
  fetchImpl = fetch as unknown as FetchImpl,
}: {
  url: SlackDataUrl;
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
}): Promise<CatalogAssets> {
  // One controller links parent cancellation and the shared deadline.
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);
  const timer = setTimeout(() => controller.abort(), CATALOG_ASSETS_TIMEOUT_MS);
  try {
    const get = async (path: string) => {
      const response = await fetchImpl(url(path), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Asset index responded ${response.status}`);
      const body = await response.text();
      if (body.length > CATALOG_ASSETS_MAX_CHARS) {
        throw new Error('Asset index is too large');
      }
      return JSON.parse(body) as unknown;
    };

    const pointer = await get(POINTER_PATH);
    const releaseId = isRecord(pointer) ? pointer.releaseId : undefined;
    const indexPath = isRecord(pointer) ? pointer.indexPath : undefined;
    const match = typeof indexPath === 'string' && INDEX_PATH.exec(indexPath);
    if (
      !match ||
      typeof releaseId !== 'string' ||
      !indexPath.includes(`/${releaseId}/`)
    ) {
      throw new Error('Asset pointer has an unexpected format');
    }
    return { releaseId, byId: parseCatalogAssetIndex(await get(match[1])) };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

/** Keeps only well-formed entries; a bad entry never discards the rest. */
export function parseCatalogAssetIndex(
  raw: unknown,
): Map<number, CatalogAssetEntry> {
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== INDEX_SCHEMA_VERSION ||
    !isRecord(raw.webbingsById)
  ) {
    throw new Error('Asset index has an unexpected format');
  }
  const byId = new Map<number, CatalogAssetEntry>();
  for (const [key, entry] of Object.entries(raw.webbingsById)) {
    if (!isRecord(entry)) continue;
    const { id, name, brand, photos } = entry;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      continue;
    }
    if (String(id) !== key || typeof name !== 'string') continue;
    if (brand !== null && typeof brand !== 'string') continue;
    const first = Array.isArray(photos) ? photos[0] : undefined;
    const small = isRecord(first) ? first.small : undefined;
    byId.set(id, {
      id,
      name,
      brand,
      photo: typeof small === 'string' && MEDIA_KEY.test(small) ? small : null,
    });
  }
  return byId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fold(value: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Photo URL per catalog model, matched by SlackData ID. The mirrored name and
 * brand must agree with the hosted record, so a reassigned ID shows no photo
 * rather than the wrong one; those IDs are returned as `mismatchedIds`.
 */
export function matchCatalogPhotos(
  assets: CatalogAssets | undefined,
  items: WebbingCatalogSnapshot[],
  url: SlackDataUrl,
): { uris: Map<number, string>; mismatchedIds: number[] } {
  const uris = new Map<number, string>();
  const mismatchedIds: number[] = [];
  if (!assets) return { uris, mismatchedIds };
  for (const item of items) {
    const entry = assets.byId.get(item.sourceId);
    if (!entry?.photo) continue;
    if (
      fold(entry.name) !== fold(item.name) ||
      fold(entry.brand) !== fold(item.brandName)
    ) {
      mismatchedIds.push(item.sourceId);
      continue;
    }
    uris.set(item.sourceId, url(`media/${entry.photo}`));
  }
  return { uris, mismatchedIds };
}

// ============================================================================
// Query cache contract
// ============================================================================

export const catalogAssetsQueryKey = ['webbing-catalog', 'assets', 1] as const;

/** Memory only and explicitly loaded, like the hosted catalog. */
export const catalogAssetsQueryOptions = {
  queryKey: catalogAssetsQueryKey,
  enabled: false,
  staleTime: 30 * 60_000,
  gcTime: 60 * 60_000,
  retry: false,
  refetchOnMount: false,
  retryOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  meta: { persistOffline: false },
} as const;

/**
 * Load when the picker opens unless a fetch is running or a result younger
 * than 30 minutes exists. A failure leaves no result, so the next open tries
 * again; nothing retries in the background.
 */
export function shouldLoadCatalogAssets(
  state:
    | { dataUpdatedAt: number; fetchStatus: 'fetching' | 'paused' | 'idle' }
    | undefined,
  nowMs: number,
) {
  if (!state) return true;
  if (state.fetchStatus !== 'idle') return false;
  return (
    state.dataUpdatedAt === 0 ||
    nowMs - state.dataUpdatedAt > catalogAssetsQueryOptions.staleTime
  );
}
