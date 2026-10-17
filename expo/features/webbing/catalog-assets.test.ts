import type { WebbingCatalogSnapshot } from '@chooselife/ui';

import {
  CATALOG_ASSETS_MAX_CHARS,
  CATALOG_ASSETS_TIMEOUT_MS,
  catalogAssetsQueryOptions,
  fetchCatalogAssets,
  matchCatalogPhotos,
  parseCatalogAssetIndex,
  shouldLoadCatalogAssets,
  type CatalogAssets,
} from './catalog-assets';

const RELEASE = 'a'.repeat(64);
const url = (path: string) => `https://cdn.example.com/slackdata/${path}`;

const pointer = {
  schemaVersion: 1,
  releaseId: RELEASE,
  indexPath: `slackdata/releases/${RELEASE}/index.json`,
  sourceCommit: 'd7cd9ab33e40689c78c628a938c4847a42aefd53',
  sourceCommittedAt: '2026-10-16T23:34:05Z',
  sourceVersion: 1,
  lastSuccessfulCheckAt: '2026-10-17T05:43:00Z',
};

const photo = (id: number, key: string) => ({
  id: key,
  small: `webbings/${id}/${key}-480.webp`,
  large: `webbings/${id}/${key}-1600.webp`,
});

const index = {
  schemaVersion: 1,
  webbingsById: {
    '54': {
      id: 54,
      name: 'Nova',
      brand: 'Slack Inov',
      photos: [photo(54, '5ef8465af089d95b'), photo(54, '0f34b314bf5aed2c')],
      warnings: [{ id: '10', solution: 'Do NOT use for highlining.' }],
    },
    '265': {
      id: 265,
      name: 'Nova Magic 25',
      brand: 'Landcruising',
      photos: [photo(265, '6b6d604f26f8c624')],
      warnings: [],
    },
    '7': { id: 7, name: 'No Photos', brand: null, photos: [], warnings: [] },
  },
};

function snapshot(
  sourceId: number,
  name: string,
  brandName: string | null,
): WebbingCatalogSnapshot {
  return { sourceId, name, brandName } as WebbingCatalogSnapshot;
}

type Reply = { status?: number; body: string } | (() => Promise<never>);

function fakeFetch(replies: Record<string, Reply>) {
  return jest.fn(async (input: string, init: { signal: AbortSignal }) => {
    const reply = replies[input];
    if (!reply) throw new TypeError('Network request failed');
    if (typeof reply === 'function') {
      return new Promise<never>((_, reject) =>
        init.signal.addEventListener('abort', () =>
          reject(new Error('Aborted')),
        ),
      );
    }
    const status = reply.status ?? 200;
    return { ok: status < 400, status, text: async () => reply.body };
  });
}

const okReplies = {
  [url('latest.json')]: { body: JSON.stringify(pointer) },
  [url(`releases/${RELEASE}/index.json`)]: { body: JSON.stringify(index) },
};

describe('fetchCatalogAssets', () => {
  it('reads the pointer, then the immutable index it names', async () => {
    const fetchImpl = fakeFetch(okReplies);
    const assets = await fetchCatalogAssets({ url, fetchImpl });
    expect(fetchImpl.mock.calls.map(([input]) => input)).toEqual([
      url('latest.json'),
      url(`releases/${RELEASE}/index.json`),
    ]);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    expect(assets.releaseId).toBe(RELEASE);
    expect(assets.byId.get(54)?.photo).toBe(
      'webbings/54/5ef8465af089d95b-480.webp',
    );
    expect(assets.byId.get(265)?.photo).toBe(
      'webbings/265/6b6d604f26f8c624-480.webp',
    );
    expect(assets.byId.get(7)?.photo).toBeNull();
  });

  it.each([
    ['another host', { indexPath: 'https://evil.example/index.json' }],
    ['traversal', { indexPath: `slackdata/releases/../${RELEASE}/index.json` }],
    ['mismatched release', { releaseId: 'b'.repeat(64) }],
    ['missing path', { indexPath: undefined }],
  ])('rejects a pointer naming %s', async (_, patch) => {
    const fetchImpl = fakeFetch({
      [url('latest.json')]: { body: JSON.stringify({ ...pointer, ...patch }) },
    });
    await expect(fetchCatalogAssets({ url, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['HTTP errors', { status: 404, body: '' }],
    ['HTML', { body: '<html>oops</html>' }],
    ['oversize bodies', { body: ' '.repeat(CATALOG_ASSETS_MAX_CHARS + 1) }],
  ])('rejects %s', async (_, reply) => {
    const fetchImpl = fakeFetch({ [url('latest.json')]: reply });
    await expect(fetchCatalogAssets({ url, fetchImpl })).rejects.toThrow();
  });

  it('gives up after the five-second budget', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = fakeFetch({
        [url('latest.json')]: { body: JSON.stringify(pointer) },
        [url(`releases/${RELEASE}/index.json`)]: () =>
          Promise.reject(new Error('unused')),
      });
      const result = fetchCatalogAssets({ url, fetchImpl });
      const assertion = expect(result).rejects.toThrow('Aborted');
      await jest.advanceTimersByTimeAsync(CATALOG_ASSETS_TIMEOUT_MS);
      await assertion;
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops when the parent cancels', async () => {
    const parent = new AbortController();
    const fetchImpl = fakeFetch({
      [url('latest.json')]: () => Promise.reject(new Error('unused')),
    });
    const result = fetchCatalogAssets({
      url,
      fetchImpl,
      signal: parent.signal,
    });
    parent.abort();
    await expect(result).rejects.toThrow('Aborted');
  });
});

describe('parseCatalogAssetIndex', () => {
  it('rejects an unknown schema', () => {
    expect(() =>
      parseCatalogAssetIndex({ ...index, schemaVersion: 2 }),
    ).toThrow();
    expect(() => parseCatalogAssetIndex([])).toThrow();
  });

  it('skips malformed entries and unsafe photo keys only', () => {
    const byId = parseCatalogAssetIndex({
      schemaVersion: 1,
      webbingsById: {
        '1': { id: 2, name: 'Key mismatch', brand: null, photos: [] },
        '3': { id: 3, name: 42, brand: null },
        '4': {
          id: 4,
          name: 'Traversal',
          brand: null,
          photos: [{ small: '../../avatars/x.webp' }],
        },
        '5': {
          id: 5,
          name: 'Remote',
          brand: null,
          photos: [{ small: 'https://evil.example/x.webp' }],
        },
        '6': {
          id: 6,
          name: 'Fine',
          brand: 'B',
          photos: [{ small: 'a/b.webp' }],
        },
      },
    });
    expect([...byId.keys()]).toEqual([4, 5, 6]);
    expect(byId.get(4)?.photo).toBeNull();
    expect(byId.get(5)?.photo).toBeNull();
    expect(byId.get(6)?.photo).toBe('a/b.webp');
  });
});

describe('matchCatalogPhotos', () => {
  const assets: CatalogAssets = {
    releaseId: RELEASE,
    byId: parseCatalogAssetIndex(index),
  };

  it('resolves Nova and Nova Magic 25 to their own photos by ID', () => {
    const { uris, mismatchedIds } = matchCatalogPhotos(
      assets,
      [
        snapshot(265, 'Nova Magic 25', 'Landcruising'),
        snapshot(54, 'Nova', 'Slack Inov'),
      ],
      url,
    );
    expect(uris.get(54)).toBe(
      url('media/webbings/54/5ef8465af089d95b-480.webp'),
    );
    expect(uris.get(265)).toBe(
      url('media/webbings/265/6b6d604f26f8c624-480.webp'),
    );
    expect(mismatchedIds).toEqual([]);
  });

  it('tolerates case, accents and spacing only', () => {
    const { uris } = matchCatalogPhotos(
      assets,
      [snapshot(54, '  nóva ', 'SLACK  inov')],
      url,
    );
    expect(uris.has(54)).toBe(true);
  });

  it('skips and reports an ID whose name or brand changed', () => {
    const { uris, mismatchedIds } = matchCatalogPhotos(
      assets,
      [
        snapshot(54, 'Nova Magic 25', 'Slack Inov'),
        snapshot(265, 'Nova Magic 25', null),
      ],
      url,
    );
    expect(uris.size).toBe(0);
    expect(mismatchedIds).toEqual([54, 265]);
  });

  it('shows nothing for models without photos or without assets', () => {
    expect(
      matchCatalogPhotos(assets, [snapshot(7, 'No Photos', null)], url).uris
        .size,
    ).toBe(0);
    expect(
      matchCatalogPhotos(undefined, [snapshot(54, 'Nova', 'Slack Inov')], url)
        .uris.size,
    ).toBe(0);
  });
});

describe('asset query contract', () => {
  const now = 10 * 60 * 60_000;

  it('is memory-only and never loads by itself', () => {
    expect(catalogAssetsQueryOptions).toMatchObject({
      enabled: false,
      retry: false,
      refetchOnReconnect: false,
      meta: { persistOffline: false },
    });
  });

  it('loads on open without a fresh result, never during a fetch', () => {
    expect(shouldLoadCatalogAssets(undefined, now)).toBe(true);
    expect(
      shouldLoadCatalogAssets({ dataUpdatedAt: 0, fetchStatus: 'idle' }, now),
    ).toBe(true);
    expect(
      shouldLoadCatalogAssets(
        { dataUpdatedAt: 0, fetchStatus: 'fetching' },
        now,
      ),
    ).toBe(false);
    expect(
      shouldLoadCatalogAssets(
        { dataUpdatedAt: now - 29 * 60_000, fetchStatus: 'idle' },
        now,
      ),
    ).toBe(false);
    expect(
      shouldLoadCatalogAssets(
        { dataUpdatedAt: now - 31 * 60_000, fetchStatus: 'idle' },
        now,
      ),
    ).toBe(true);
  });
});
