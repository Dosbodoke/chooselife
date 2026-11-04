import {
  normalizeSlackDataWebbing,
  SLACKDATA_API_BASE_URL,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';

// Hosted SlackData read API. Fixed: never user-selected, never localhost.
export const WEBBING_CATALOG_PAGE_SIZE = 100;
export const WEBBING_CATALOG_MAX_PAGES = 20;
export const WEBBING_CATALOG_TOTAL_TIMEOUT_MS = 30_000;
export const WEBBING_CATALOG_REQUEST_TIMEOUT_MS = 10_000;
/** Post-read bound on one decoded page; not a streaming memory guarantee. */
export const WEBBING_CATALOG_MAX_PAGE_CHARS = 5 * 1024 * 1024;
export const DEFAULT_RETRY_AFTER_MS = 60_000;
export const MAX_RETRY_AFTER_MS = 5 * 60_000;

export interface CatalogResult {
  items: WebbingCatalogSnapshot[];
  fetchedAt: string;
  invalidRecordCount: number;
  degradedFieldCount: number;
}

export type CatalogErrorKind =
  | 'network'
  | 'timeout'
  | 'http'
  | 'rate-limit'
  | 'schema'
  | 'pagination-limit'
  | 'cancelled';

export class CatalogError extends Error {
  constructor(
    readonly kind: CatalogErrorKind,
    message: string,
    readonly details: { status?: number; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

type FetchImpl = (
  input: string,
  init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface FetchWebbingCatalogOptions {
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
  now?: () => Date;
}

/**
 * Parse Retry-After (seconds or HTTP date). Missing or malformed values fall
 * back to 60 seconds; the result is capped at 5 minutes. This is a retry
 * suggestion, not an upstream quota.
 */
export function parseRetryAfterMs(header: string | null, now: Date): number {
  const value = header?.trim();
  let ms: number | null = null;
  if (value && /^\d+$/.test(value)) {
    ms = Number(value) * 1000;
  } else if (value) {
    const date = Date.parse(value);
    if (!Number.isNaN(date)) ms = Math.max(0, date - now.getTime());
  }
  if (ms === null || !Number.isFinite(ms)) ms = DEFAULT_RETRY_AFTER_MS;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}

/**
 * Fetch the complete hosted webbing catalog, page by page.
 *
 * Offsets advance by the raw page length, so rejected rows never shift the
 * next page. Any failure discards earlier pages: callers see either a
 * complete best-effort catalog or an error. No retries, no auth, no body.
 */
export async function fetchWebbingCatalog({
  signal,
  fetchImpl = fetch as unknown as FetchImpl,
  now = () => new Date(),
}: FetchWebbingCatalogOptions = {}): Promise<CatalogResult> {
  const deadline = now().getTime() + WEBBING_CATALOG_TOTAL_TIMEOUT_MS;
  const byId = new Map<number, WebbingCatalogSnapshot>();
  let invalidRecordCount = 0;
  let degradedFieldCount = 0;
  let rawRecordCount = 0;

  for (let page = 0; page < WEBBING_CATALOG_MAX_PAGES; page++) {
    const offset = page * WEBBING_CATALOG_PAGE_SIZE;
    const records = await fetchPage({
      url: `${SLACKDATA_API_BASE_URL}/webbing/?offset=${offset}&limit=${WEBBING_CATALOG_PAGE_SIZE}`,
      signal,
      fetchImpl,
      now,
      deadline,
    });
    const retrievedAt = now().toISOString();
    rawRecordCount += records.length;

    let pageValid = 0;
    for (const raw of records) {
      const result = normalizeSlackDataWebbing(raw, retrievedAt);
      if (!result.ok) {
        invalidRecordCount++;
        continue;
      }
      pageValid++;
      degradedFieldCount += result.degradedFields.length;
      if (!byId.has(result.snapshot.sourceId)) {
        byId.set(result.snapshot.sourceId, result.snapshot);
      }
    }
    if (records.length > 0 && pageValid === 0) {
      throw new CatalogError('schema', 'No usable webbing records in response');
    }

    if (records.length < WEBBING_CATALOG_PAGE_SIZE) {
      if (rawRecordCount > 0 && byId.size === 0) {
        throw new CatalogError(
          'schema',
          'No usable webbing records in catalog',
        );
      }
      return {
        items: sortCatalog([...byId.values()]),
        fetchedAt: now().toISOString(),
        invalidRecordCount,
        degradedFieldCount,
      };
    }
  }

  throw new CatalogError(
    'pagination-limit',
    `Catalog exceeded ${WEBBING_CATALOG_MAX_PAGES} pages`,
  );
}

async function fetchPage({
  url,
  signal,
  fetchImpl,
  now,
  deadline,
}: {
  url: string;
  signal?: AbortSignal;
  fetchImpl: FetchImpl;
  now: () => Date;
  deadline: number;
}): Promise<unknown[]> {
  if (signal?.aborted) throw new CatalogError('cancelled', 'Cancelled');
  const remaining = deadline - now().getTime();
  if (remaining <= 0)
    throw new CatalogError('timeout', 'Catalog request timed out');

  // One local controller links parent cancellation and the request timeout.
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    Math.min(WEBBING_CATALOG_REQUEST_TIMEOUT_MS, remaining),
  );

  try {
    let response: Awaited<ReturnType<FetchImpl>>;
    let body: string;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          throw new CatalogError('rate-limit', 'Catalog is temporarily busy', {
            status: response.status,
            retryAfterMs: parseRetryAfterMs(
              response.headers.get('retry-after'),
              now(),
            ),
          });
        }
        throw new CatalogError('http', `Catalog responded ${response.status}`, {
          status: response.status,
        });
      }
      const declaredLength = Number(response.headers.get('content-length'));
      if (declaredLength > WEBBING_CATALOG_MAX_PAGE_CHARS) {
        throw new CatalogError('schema', 'Catalog page is too large');
      }
      body = await response.text();
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      if (signal?.aborted) throw new CatalogError('cancelled', 'Cancelled');
      if (timedOut)
        throw new CatalogError('timeout', 'Catalog request timed out');
      throw new CatalogError('network', 'Catalog could not be reached');
    }

    if (body.length > WEBBING_CATALOG_MAX_PAGE_CHARS) {
      throw new CatalogError('schema', 'Catalog page is too large');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new CatalogError('schema', 'Catalog returned an unexpected format');
    }
    if (!Array.isArray(parsed)) {
      throw new CatalogError('schema', 'Catalog returned an unexpected format');
    }
    return parsed;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

// ============================================================================
// Local search
// ============================================================================

function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function sortKey(item: WebbingCatalogSnapshot) {
  return fold(`${item.brandName ?? ''} ${item.name}`.trim());
}

function sortCatalog(items: WebbingCatalogSnapshot[]) {
  return items.sort((a, b) => {
    const byName = sortKey(a).localeCompare(sortKey(b));
    return byName || a.sourceId - b.sourceId;
  });
}

/**
 * Case- and accent-insensitive token search over brand, name and version.
 * Every whitespace-separated token must match. Never issues a request.
 */
export function filterWebbingCatalog(
  items: WebbingCatalogSnapshot[],
  query: string,
): WebbingCatalogSnapshot[] {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;
  return items.filter((item) => {
    const haystack = fold(
      [item.brandName, item.name, item.version].filter(Boolean).join(' '),
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

// ============================================================================
// Query cache contract
// ============================================================================

export const webbingCatalogQueryKey = [
  'webbing-catalog',
  'slackdata',
  1,
] as const;

/**
 * Memory-only cache options. `enabled: false` keeps mount, focus, reconnect
 * and enable transitions from ever fetching; loads are explicit.
 */
export const webbingCatalogQueryOptions = {
  queryKey: webbingCatalogQueryKey,
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

interface CatalogQueryState {
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

/** First open loads only if no attempt or result exists in the cache yet. */
export function shouldLoadCatalogOnOpen(state: CatalogQueryState | undefined) {
  if (!state) return true;
  return (
    state.dataUpdatedAt === 0 &&
    state.errorUpdatedAt === 0 &&
    state.fetchStatus === 'idle'
  );
}

/** When the cooldown requested by the last failure ends, if it asked for one. */
export function getCatalogRetryAt(
  error: unknown,
  errorUpdatedAt: number,
): number | null {
  if (error instanceof CatalogError && error.details.retryAfterMs) {
    return errorUpdatedAt + error.details.retryAfterMs;
  }
  return null;
}

/** Whether a manual retry/refresh is allowed now, honoring any cooldown. */
export function getCatalogRetryAvailability(
  error: unknown,
  errorUpdatedAt: number,
  nowMs: number,
): { canRetry: boolean; retryAt: number | null } {
  const retryAt = getCatalogRetryAt(error, errorUpdatedAt);
  if (retryAt !== null && retryAt > nowMs) return { canRetry: false, retryAt };
  return { canRetry: true, retryAt: null };
}

export function isCatalogStale(dataUpdatedAt: number, nowMs: number) {
  return (
    dataUpdatedAt > 0 &&
    nowMs - dataUpdatedAt > webbingCatalogQueryOptions.staleTime
  );
}
