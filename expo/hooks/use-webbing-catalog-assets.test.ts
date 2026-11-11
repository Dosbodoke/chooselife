import { normalizeSlackDataWebbing } from '@chooselife/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseCatalogAssetIndex } from '~/features/webbing/catalog-assets';

import {
  useSavedWebbingCatalogPhotos,
  useWebbingCatalogAssets,
} from './use-webbing-catalog-assets';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock('~/lib/r2', () => ({
  getR2PublicUrl: (bucket: string, path: string) =>
    `https://cdn.example.com/${bucket}/${path}`,
}));

const result = normalizeSlackDataWebbing(
  { id: 123, name: 'Path', brand_name: 'Cong Gear' },
  '2026-11-11T00:00:00.000Z',
);
if (!result.ok) throw new Error('Invalid fixture');
const snapshot = result.snapshot;
const assets = {
  releaseId: 'a'.repeat(64),
  byId: parseCatalogAssetIndex({
    schemaVersion: 1,
    webbingsById: {
      '123': {
        id: 123,
        name: 'Path',
        brand: 'Cong Gear',
        photos: [{ small: 'webbings/123/path.webp' }],
      },
    },
  }),
};

beforeEach(() => {
  jest
    .mocked(useQueryClient)
    .mockReturnValue({} as ReturnType<typeof useQueryClient>);
  jest
    .mocked(useQuery)
    .mockReturnValue({ data: assets } as ReturnType<typeof useQuery>);
});

it('loads and resolves the shared catalog photo for saved Path pieces without opening the picker', () => {
  const photos = useSavedWebbingCatalogPhotos([
    { catalog_snapshot: snapshot },
    { catalog_snapshot: snapshot },
  ]);
  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: true, refetchOnMount: true }),
  );
  expect(photos.get(snapshot.sourceId)).toBe(
    'https://cdn.example.com/slackdata/media/webbings/123/path.webp',
  );
});

it('does not fetch for manual, legacy, invalid or unknown-version snapshots', () => {
  const photos = useSavedWebbingCatalogPhotos([
    {},
    { catalog_snapshot: { ...snapshot, schemaVersion: 2 } },
    { catalog_snapshot: { sourceId: 123 } },
  ]);
  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  expect(photos.size).toBe(0);
});

it('keeps picker assets lazy by default', () => {
  useWebbingCatalogAssets();
  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false, refetchOnMount: false }),
  );
});

it('leaves the existing placeholder when the mirror is unavailable or its identity differs', () => {
  jest
    .mocked(useQuery)
    .mockReturnValueOnce({ data: undefined } as ReturnType<typeof useQuery>);
  expect(
    useSavedWebbingCatalogPhotos([{ catalog_snapshot: snapshot }]).size,
  ).toBe(0);
  expect(
    useSavedWebbingCatalogPhotos([
      { catalog_snapshot: { ...snapshot, brandName: 'Other' } },
    ]).size,
  ).toBe(0);
});
