import {
  normalizeSlackDataWebbing,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';

import {
  applyCatalogFilters,
  availableCatalogFilters,
  catalogFlags,
  nextCatalogSort,
  sortCatalogItems,
  stretchReference,
} from './catalog-browse';

function model(raw: Record<string, unknown>): WebbingCatalogSnapshot {
  const result = normalizeSlackDataWebbing(
    { name: `Model ${raw.id}`, brand_name: 'Brand', ...raw },
    '2026-10-15T00:00:00.000Z',
  );
  if (!result.ok) throw new Error('fixture rejected');
  return result.snapshot;
}

const items = [
  model({
    id: 1,
    breaking_strength: 44,
    width: 25,
    weight: 71.5,
    material: ['Polyester'],
    active: false,
  }),
  model({
    id: 2,
    breaking_strength: 20,
    width: 25,
    weight: 34,
    material: ['Polyester'],
  }),
  model({
    id: 3,
    breaking_strength: 60,
    width: 25,
    material: ['Dyneema/HMPE'],
    isa_certified: true,
    isa_class: 'A',
  }),
  model({
    id: 4,
    width: 18,
    weight: 32,
    material: ['Polyester', 'Dyneema/HMPE'],
  }),
];
const ids = (list: WebbingCatalogSnapshot[]) => list.map((m) => m.sourceId);

describe('sortCatalogItems', () => {
  it('sorts numerically with unknown values last in both directions', () => {
    expect(
      ids(sortCatalogItems(items, { key: 'strength', desc: true })),
    ).toEqual([3, 1, 2, 4]);
    expect(
      ids(sortCatalogItems(items, { key: 'strength', desc: false })),
    ).toEqual([2, 1, 3, 4]);
    expect(
      ids(sortCatalogItems(items, { key: 'weight', desc: false })),
    ).toEqual([4, 2, 1, 3]);
  });

  it('keeps catalog order for ties and for brand order', () => {
    expect(ids(sortCatalogItems(items, { key: 'width', desc: true }))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(sortCatalogItems(items, { key: 'brand', desc: false })).toBe(items);
    expect(ids(sortCatalogItems(items, { key: 'brand', desc: true }))).toEqual([
      4, 3, 2, 1,
    ]);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sortCatalogItems(items, { key: 'strength', desc: true });
    expect(items).toEqual(copy);
  });
});

describe('nextCatalogSort', () => {
  it('flips the active key and uses defaults for a new one', () => {
    expect(
      nextCatalogSort({ key: 'strength', desc: true }, 'strength'),
    ).toEqual({
      key: 'strength',
      desc: false,
    });
    expect(nextCatalogSort({ key: 'brand', desc: false }, 'strength')).toEqual({
      key: 'strength',
      desc: true,
    });
    expect(nextCatalogSort({ key: 'brand', desc: false }, 'weight')).toEqual({
      key: 'weight',
      desc: false,
    });
  });
});

describe('filters', () => {
  it('offers status filters then the materials present', () => {
    expect(availableCatalogFilters(items)).toEqual([
      { kind: 'isa-certified' },
      { kind: 'in-production' },
      { kind: 'material', material: 'Dyneema/HMPE' },
      { kind: 'material', material: 'Polyester' },
    ]);
  });

  it('requires every active filter and matches mixed fibers', () => {
    expect(
      ids(
        applyCatalogFilters(items, [
          { kind: 'material', material: 'Dyneema/HMPE' },
        ]),
      ),
    ).toEqual([3, 4]);
    expect(
      ids(
        applyCatalogFilters(items, [
          { kind: 'material', material: 'Polyester' },
          { kind: 'in-production' },
        ]),
      ),
    ).toEqual([2, 4]);
    expect(
      ids(applyCatalogFilters(items, [{ kind: 'isa-certified' }])),
    ).toEqual([3]);
  });
});

describe('stretchReference', () => {
  it('prefers 10 kN, else the nearest recorded load', () => {
    expect(
      stretchReference(
        model({
          id: 5,
          stretch:
            '[{"kn":4,"percent":1},{"kn":10,"percent":5.7},{"kn":12,"percent":6.5}]',
        }),
      ),
    ).toEqual({ kn: 10, percent: 5.7 });
    expect(
      stretchReference(model({ id: 6, stretch: '[{"kn":20,"percent":1.4}]' })),
    ).toEqual({
      kn: 20,
      percent: 1.4,
    });
    expect(stretchReference(model({ id: 7 }))).toBeNull();
  });
});

describe('catalogFlags', () => {
  it('orders safety warnings first and never treats null as a status', () => {
    expect(
      catalogFlags(
        model({
          id: 8,
          isa_warning: 'Recall',
          manufacturer_not_for_highline: true,
          isa_certified: true,
          isa_class: 'B',
          active: false,
        }),
      ),
    ).toEqual([
      { kind: 'isa-warning', text: 'Recall' },
      { kind: 'not-for-highline' },
      { kind: 'isa', isaClass: 'B' },
      { kind: 'discontinued' },
    ]);
    expect(catalogFlags(model({ id: 9 }))).toEqual([]);
  });
});
