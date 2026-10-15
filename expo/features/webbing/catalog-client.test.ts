import { QueryClient } from '@tanstack/react-query';

import {
  CatalogError,
  fetchWebbingCatalog,
  filterWebbingCatalog,
  getCatalogRetryAvailability,
  isCatalogStale,
  parseRetryAfterMs,
  shouldLoadCatalogOnOpen,
  webbingCatalogQueryKey,
  webbingCatalogQueryOptions,
} from './catalog-client';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const now = () => NOW;

const record = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Model ${id}`,
  brand_name: 'Brand',
  material: ['Polyester'],
  ...extra,
});
const records = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => record(from + i));

type Reply = {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
};

function json(value: unknown): Reply {
  return { body: JSON.stringify(value) };
}

/** Fake fetch that answers each requested offset from a script. */
function fakeFetch(pages: Record<number, Reply | (() => Promise<Reply>)>) {
  const calls: { url: string; init: unknown }[] = [];
  const fetchImpl = jest.fn(
    async (url: string, init: { signal: AbortSignal }) => {
      calls.push({ url, init });
      const offset = Number(new URL(url).searchParams.get('offset'));
      const page = pages[offset];
      if (!page) throw new TypeError('Network request failed');
      const reply = typeof page === 'function' ? await page() : page;
      if (init.signal.aborted) throw new Error('Aborted');
      const headers = new Map(
        Object.entries(reply.headers ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      );
      return {
        ok: (reply.status ?? 200) < 400,
        status: reply.status ?? 200,
        headers: {
          get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
        text: async () => reply.body ?? '',
      };
    },
  );
  return { fetchImpl, calls };
}

const offsets = (calls: { url: string }[]) =>
  calls.map((c) => Number(new URL(c.url).searchParams.get('offset')));

describe('fetchWebbingCatalog pagination', () => {
  it('requests sequential offsets until a short page (100/100/59)', async () => {
    const { fetchImpl, calls } = fakeFetch({
      0: json(records(1, 100)),
      100: json(records(101, 100)),
      200: json(records(201, 59)),
    });
    const result = await fetchWebbingCatalog({ fetchImpl, now });

    expect(offsets(calls)).toEqual([0, 100, 200]);
    expect(result.items).toHaveLength(259);
    expect(result.fetchedAt).toBe(NOW.toISOString());
    expect(result.items[0].retrievedAt).toBe(NOW.toISOString());
  });

  it('reads a final empty page when the catalog is an exact multiple', async () => {
    const { fetchImpl, calls } = fakeFetch({
      0: json(records(1, 100)),
      100: json(records(101, 100)),
      200: json([]),
    });
    const result = await fetchWebbingCatalog({ fetchImpl, now });
    expect(offsets(calls)).toEqual([0, 100, 200]);
    expect(result.items).toHaveLength(200);
  });

  it('advances by raw page length even when rows are rejected', async () => {
    const page = records(1, 100);
    page[3] = { ...page[3], id: -1 };
    page[4] = { ...page[4], name: '' };
    const { fetchImpl, calls } = fakeFetch({
      0: json(page),
      100: json(records(101, 2)),
    });
    const result = await fetchWebbingCatalog({ fetchImpl, now });
    expect(offsets(calls)).toEqual([0, 100]);
    expect(result.items).toHaveLength(100);
    expect(result.invalidRecordCount).toBe(2);
  });

  it('deduplicates repeated ids, keeping the first observed record', async () => {
    const second = records(101, 99);
    second.push(record(5, { name: 'Moved duplicate' }));
    const { fetchImpl } = fakeFetch({
      0: json(records(1, 100)),
      100: json(second),
      200: json([]),
    });
    const result = await fetchWebbingCatalog({ fetchImpl, now });
    expect(result.items).toHaveLength(199);
    expect(result.items.find((i) => i.sourceId === 5)?.name).toBe('Model 5');
  });

  it('fails instead of truncating when 20 full pages are returned', async () => {
    const pages: Record<number, Reply> = {};
    for (let p = 0; p < 21; p++)
      pages[p * 100] = json(records(p * 100 + 1, 100));
    const { fetchImpl, calls } = fakeFetch(pages);
    await expect(fetchWebbingCatalog({ fetchImpl, now })).rejects.toMatchObject(
      {
        kind: 'pagination-limit',
      },
    );
    expect(calls).toHaveLength(20);
  });

  it('sends only anonymous GET requests to the fixed HTTPS host', async () => {
    const { fetchImpl, calls } = fakeFetch({ 0: json(records(1, 3)) });
    await fetchWebbingCatalog({ fetchImpl, now });
    expect(calls[0].url).toBe(
      'https://slackdata.org/api/webbing/?offset=0&limit=100',
    );
    const init = calls[0].init as Record<string, unknown>;
    expect(init.method).toBe('GET');
    expect(init).not.toHaveProperty('body');
    expect(init).not.toHaveProperty('credentials');
    expect(init.headers).toEqual({ Accept: 'application/json' });
  });

  it('sorts by brand and name with the id as tiebreaker', async () => {
    const { fetchImpl } = fakeFetch({
      0: json([
        record(3, { brand_name: 'Zeta', name: 'A' }),
        record(2, { brand_name: 'Ábaco', name: 'Same' }),
        record(1, { brand_name: 'abaco', name: 'Same' }),
      ]),
    });
    const { items } = await fetchWebbingCatalog({ fetchImpl, now });
    expect(items.map((i) => i.sourceId)).toEqual([1, 2, 3]);
  });
});

describe('fetchWebbingCatalog failures', () => {
  it('distinguishes an empty catalog from an all-invalid response', async () => {
    const empty = fakeFetch({ 0: json([]) });
    await expect(
      fetchWebbingCatalog({ fetchImpl: empty.fetchImpl, now }),
    ).resolves.toMatchObject({ items: [], invalidRecordCount: 0 });

    const invalid = fakeFetch({ 0: json([{ id: 0 }, { name: 'no id' }]) });
    await expect(
      fetchWebbingCatalog({ fetchImpl: invalid.fetchImpl, now }),
    ).rejects.toMatchObject({ kind: 'schema' });
  });

  it.each([
    ['HTML', '<!doctype html><html></html>'],
    ['an object envelope', JSON.stringify({ results: [] })],
    ['invalid JSON', '[{"id": 1,'],
  ])('rejects %s as a schema mismatch', async (_label, body) => {
    const { fetchImpl } = fakeFetch({ 0: { body } });
    await expect(fetchWebbingCatalog({ fetchImpl, now })).rejects.toMatchObject(
      {
        kind: 'schema',
      },
    );
  });

  it('rejects oversized pages', async () => {
    const { fetchImpl } = fakeFetch({
      0: { body: `[${' '.repeat(5 * 1024 * 1024)}]` },
    });
    await expect(fetchWebbingCatalog({ fetchImpl, now })).rejects.toMatchObject(
      {
        kind: 'schema',
      },
    );
  });

  it('reports network failures and never returns earlier pages after a later failure', async () => {
    const { fetchImpl } = fakeFetch({ 0: json(records(1, 100)) });
    await expect(fetchWebbingCatalog({ fetchImpl, now })).rejects.toMatchObject(
      {
        kind: 'network',
      },
    );
  });

  it('maps HTTP errors and rate limits with a capped cooldown', async () => {
    const http = fakeFetch({ 0: { status: 500, body: 'oops' } });
    await expect(
      fetchWebbingCatalog({ fetchImpl: http.fetchImpl, now }),
    ).rejects.toMatchObject({
      kind: 'http',
      details: { status: 500 },
    });

    const limited = fakeFetch({
      0: { status: 429, headers: { 'Retry-After': '120' } },
    });
    await expect(
      fetchWebbingCatalog({ fetchImpl: limited.fetchImpl, now }),
    ).rejects.toMatchObject({
      kind: 'rate-limit',
      details: { retryAfterMs: 120_000 },
    });

    const busy = fakeFetch({ 0: { status: 503 } });
    await expect(
      fetchWebbingCatalog({ fetchImpl: busy.fetchImpl, now }),
    ).rejects.toMatchObject({
      kind: 'rate-limit',
      details: { retryAfterMs: 60_000 },
    });
    expect(busy.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('times out a hung request and clears its timer', async () => {
    jest.useFakeTimers();
    try {
      const { fetchImpl } = fakeFetch({
        0: () => new Promise<Reply>(() => undefined),
      });
      // The hung promise never settles; abort must still end the attempt.
      fetchImpl.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new Error('Aborted')),
            );
          }),
      );
      const pending = fetchWebbingCatalog({ fetchImpl, now });
      jest.advanceTimersByTime(10_000);
      await expect(pending).rejects.toMatchObject({ kind: 'timeout' });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports parent cancellation as cancelled, not an outage', async () => {
    const parent = new AbortController();
    const { fetchImpl } = fakeFetch({});
    fetchImpl.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
        }),
    );
    const pending = fetchWebbingCatalog({
      fetchImpl,
      now,
      signal: parent.signal,
    });
    parent.abort();
    const error = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CatalogError);
    expect((error as CatalogError).kind).toBe('cancelled');
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds and HTTP dates, defaulting and capping', () => {
    expect(parseRetryAfterMs('30', NOW)).toBe(30_000);
    expect(
      parseRetryAfterMs(new Date(NOW.getTime() + 90_000).toUTCString(), NOW),
    ).toBe(90_000);
    expect(parseRetryAfterMs(null, NOW)).toBe(60_000);
    expect(parseRetryAfterMs('soon', NOW)).toBe(60_000);
    expect(parseRetryAfterMs('3600', NOW)).toBe(300_000);
  });
});

describe('filterWebbingCatalog', () => {
  let items: Awaited<ReturnType<typeof fetchWebbingCatalog>>['items'];
  beforeAll(async () => {
    const { fetchImpl } = fakeFetch({
      0: json([
        record(1, {
          brand_name: 'Landcruising',
          name: 'Core 2 HS',
          active: false,
        }),
        record(2, {
          brand_name: 'Balance Community',
          name: 'Ságitta',
          version: 'v2',
        }),
        record(3, { brand_name: 'Landcruising', name: 'Wing' }),
      ]),
    });
    ({ items } = await fetchWebbingCatalog({ fetchImpl, now }));
  });

  it('matches every token across brand, name and version, ignoring accents and case', () => {
    expect(
      filterWebbingCatalog(items, '  landcruising   core ').map(
        (i) => i.sourceId,
      ),
    ).toEqual([1]);
    expect(
      filterWebbingCatalog(items, 'SAGITTA v2').map((i) => i.sourceId),
    ).toEqual([2]);
    expect(filterWebbingCatalog(items, 'balance wing')).toEqual([]);
    expect(filterWebbingCatalog(items, '   ')).toHaveLength(3);
  });

  it('keeps discontinued models findable', () => {
    const [core] = filterWebbingCatalog(items, 'core');
    expect(core.active).toBe(false);
  });
});

describe('catalog cache contract', () => {
  it('is memory-only and never auto-fetches', () => {
    expect(webbingCatalogQueryOptions.meta.persistOffline).toBe(false);
    expect(webbingCatalogQueryOptions.enabled).toBe(false);
    expect(webbingCatalogQueryOptions.retry).toBe(false);
    expect(webbingCatalogQueryOptions.staleTime).toBe(30 * 60_000);
    expect(webbingCatalogQueryOptions.gcTime).toBe(60 * 60_000);
  });

  it('loads on first open only; fresh, stale, and failed caches make no request', async () => {
    const client = new QueryClient();
    const queryFn = jest.fn(async () => ({
      items: [],
      fetchedAt: NOW.toISOString(),
      invalidRecordCount: 0,
      degradedFieldCount: 0,
    }));
    const open = async () => {
      if (
        shouldLoadCatalogOnOpen(client.getQueryState(webbingCatalogQueryKey))
      ) {
        await client.fetchQuery({ ...webbingCatalogQueryOptions, queryFn });
      }
    };

    await open();
    await open();
    expect(queryFn).toHaveBeenCalledTimes(1);
    // Stale data is shown with an explicit refresh action, not refetched on open.
    expect(isCatalogStale(Date.now() - 31 * 60_000, Date.now())).toBe(true);

    const failing = new QueryClient();
    const failingFn = jest.fn(async () => {
      throw new CatalogError('rate-limit', 'busy', { retryAfterMs: 60_000 });
    });
    await failing
      .fetchQuery({ ...webbingCatalogQueryOptions, queryFn: failingFn })
      .catch(() => undefined);
    const state = failing.getQueryState(webbingCatalogQueryKey)!;
    expect(shouldLoadCatalogOnOpen(state)).toBe(false);
    expect(failingFn).toHaveBeenCalledTimes(1);
    expect(
      getCatalogRetryAvailability(
        state.error,
        state.errorUpdatedAt,
        state.errorUpdatedAt + 1000,
      ),
    ).toEqual({ canRetry: false, retryAt: state.errorUpdatedAt + 60_000 });
    expect(
      getCatalogRetryAvailability(
        state.error,
        state.errorUpdatedAt,
        state.errorUpdatedAt + 60_000,
      ),
    ).toEqual({ canRetry: true, retryAt: null });
    client.clear();
    failing.clear();
  });

  it('keeps the previous complete catalog after a refresh failure', async () => {
    const client = new QueryClient();
    const good = {
      items: [],
      fetchedAt: NOW.toISOString(),
      invalidRecordCount: 0,
      degradedFieldCount: 0,
    };
    await client.fetchQuery({
      ...webbingCatalogQueryOptions,
      queryFn: async () => good,
    });
    await client
      .fetchQuery({
        ...webbingCatalogQueryOptions,
        staleTime: 0,
        queryFn: async () => {
          throw new CatalogError('network', 'down');
        },
      })
      .catch(() => undefined);
    expect(client.getQueryData(webbingCatalogQueryKey)).toBe(good);
    expect(client.getQueryState(webbingCatalogQueryKey)?.status).toBe('error');
    client.clear();
  });
});
