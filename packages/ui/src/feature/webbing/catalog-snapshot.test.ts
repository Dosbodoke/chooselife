/// <reference types="jest" />

import {
  getWebbingDisplayName,
  normalizeSlackDataWebbing,
  parseWebbingCatalogSnapshot,
  resolveWebbingSpecs,
  SLACKDATA_ATTRIBUTION,
  SLACKDATA_LICENSE_URL,
  type WebbingCatalogSnapshot,
} from './catalog-snapshot';

const RETRIEVED_AT = '2026-10-14T12:00:00.000Z';

// Adapted from SlackData webbing id 1 (CC BY-SA 4.0, International Slackline
// Association); the stretch curve is shortened.
const upstream = {
  id: 1,
  name: 'Core 2 HS',
  brand_name: 'Landcruising',
  material: ['Polyester'],
  webbing_construction: 'Core/Sheath',
  width: 25,
  thickness: 3.5,
  weight: 71.5,
  breaking_strength: 44.0,
  isa_class: null,
  isa_certified: false,
  isa_warning: null,
  manufacturer_not_for_highline: null,
  active: false,
  stretch: '[{"kn":4,"percent":1.1},{"kn":6,"percent":1.6}]',
  product_url: 'https://example.com/core-2-hs',
};

function normalize(raw: unknown) {
  const result = normalizeSlackDataWebbing(raw, RETRIEVED_AT);
  if (!result.ok) throw new Error(`rejected: ${result.reason}`);
  return result;
}

describe('normalizeSlackDataWebbing', () => {
  it('keeps only the listed normalized fields with source attribution', () => {
    const { snapshot, degradedFields } = normalize({
      ...upstream,
      price: 2.2,
      gear_sellers: [{ name: 'shop' }],
      future_field: 'ignored',
    });

    expect(degradedFields).toEqual([]);
    expect(snapshot).toEqual({
      schemaVersion: 1,
      source: 'slackdata',
      gearType: 'webbing',
      sourceId: 1,
      sourceUrl: 'https://slackdata.org/api/webbing/1',
      retrievedAt: RETRIEVED_AT,
      attribution: SLACKDATA_ATTRIBUTION,
      licenseUrl: SLACKDATA_LICENSE_URL,
      normalizationVersion: 1,
      name: 'Core 2 HS',
      brandName: 'Landcruising',
      version: null,
      materials: ['Polyester'],
      construction: 'Core/Sheath',
      widthMm: 25,
      thicknessMm: 3.5,
      weightGramsPerMeter: 71.5,
      breakingStrengthKn: 44,
      stretch: [
        { kn: 4, percent: 1.1 },
        { kn: 6, percent: 1.6 },
      ],
      productUrl: 'https://example.com/core-2-hs',
      active: false,
      isaCertified: false,
      isaClass: null,
      isaCertificate: null,
      isaWarning: null,
      manufacturerNotForHighline: null,
      manufacturerNotForHighlineSource: null,
    });
    expect(snapshot).not.toHaveProperty('recommendedLifetimeDays');
    expect(snapshot).not.toHaveProperty('price');
  });

  it('keeps mixed fibers and future construction strings instead of legacy enums', () => {
    const { snapshot } = normalize({
      ...upstream,
      material: ['Dyneema/HMPE', 'Vectran', ' Polyester ', 'Vectran'],
      webbing_construction: 'Braided Hybrid',
    });
    expect(snapshot.materials).toEqual(['Dyneema/HMPE', 'Vectran', 'Polyester']);
    expect(snapshot.construction).toBe('Braided Hybrid');
  });

  it('keeps missing specifications unknown rather than inventing defaults', () => {
    const { snapshot, degradedFields } = normalize({ id: 7, name: 'Mystery' });
    expect(degradedFields).toEqual([]);
    expect(snapshot.materials).toBeNull();
    expect(snapshot.construction).toBeNull();
    expect(snapshot.breakingStrengthKn).toBeNull();
    expect(snapshot.isaCertified).toBeNull();
    expect(snapshot.active).toBeNull();
    expect(snapshot.manufacturerNotForHighline).toBeNull();
  });

  it('turns zero or invalid optional values into unknown with field diagnostics', () => {
    const { snapshot, degradedFields } = normalize({
      ...upstream,
      width: 0,
      weight: -3,
      thickness: 'thick',
      breaking_strength: Infinity,
      stretch: 'alert(1)',
      product_url: 'javascript:alert(1)',
      active: 'yes',
      material: 'Polyester',
    });
    expect(snapshot.widthMm).toBeNull();
    expect(snapshot.weightGramsPerMeter).toBeNull();
    expect(snapshot.thicknessMm).toBeNull();
    expect(snapshot.breakingStrengthKn).toBeNull();
    expect(snapshot.stretch).toBeNull();
    expect(snapshot.productUrl).toBeNull();
    expect(snapshot.active).toBeNull();
    expect(snapshot.materials).toBeNull();
    expect(degradedFields.sort()).toEqual(
      [
        'active',
        'breaking_strength',
        'material',
        'product_url',
        'stretch',
        'thickness',
        'weight',
        'width',
      ].sort(),
    );
  });

  it('rejects stretch curves with negative or non-numeric points', () => {
    for (const stretch of [
      '[{"kn":-1,"percent":1}]',
      '[{"kn":"4","percent":1}]',
      '{"kn":4,"percent":1}',
      '[]',
    ]) {
      const { snapshot, degradedFields } = normalize({ ...upstream, stretch });
      expect(snapshot.stretch).toBeNull();
      expect(degradedFields).toContain('stretch');
    }
  });

  it('rejects records without a usable identity or name', () => {
    for (const raw of [
      null,
      'Core 2',
      [],
      { ...upstream, id: 0 },
      { ...upstream, id: -2 },
      { ...upstream, id: 1.5 },
      { ...upstream, id: '1' },
      { ...upstream, name: '   ' },
      { ...upstream, name: undefined },
    ]) {
      expect(normalizeSlackDataWebbing(raw, RETRIEVED_AT).ok).toBe(false);
    }
  });
});

describe('parseWebbingCatalogSnapshot', () => {
  const snapshot = normalize(upstream).snapshot;

  it('round-trips a stored snapshot', () => {
    expect(parseWebbingCatalogSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
  });

  it('returns null for unknown versions and invalid values without throwing', () => {
    expect(parseWebbingCatalogSnapshot({ ...snapshot, schemaVersion: 2 })).toBeNull();
    expect(parseWebbingCatalogSnapshot({ ...snapshot, name: '' })).toBeNull();
    expect(parseWebbingCatalogSnapshot({ ...snapshot, sourceId: 0 })).toBeNull();
    expect(
      parseWebbingCatalogSnapshot({
        ...snapshot,
        sourceUrl: 'https://evil.example/api/webbing/1',
      }),
    ).toBeNull();
    expect(
      parseWebbingCatalogSnapshot({ ...snapshot, retrievedAt: 'yesterday' }),
    ).toBeNull();
    expect(parseWebbingCatalogSnapshot('snapshot')).toBeNull();
    expect(parseWebbingCatalogSnapshot(null)).toBeNull();
  });
});

describe('resolveWebbingSpecs', () => {
  const snapshot: WebbingCatalogSnapshot = {
    ...normalize(upstream).snapshot,
    isaClass: 'B',
  };
  const legacyModel = {
    name: 'Brasileirinha',
    material: 'polyester',
    weave: 'flat',
    strength_class: 'A',
    recommended_lifetime_days: 720,
    image_url: 'models/brasileirinha.png',
  };

  it('prefers a valid snapshot and never derives a lifetime from it', () => {
    const resolved = resolveWebbingSpecs({
      catalog_snapshot: snapshot,
      model: null,
      strength_class: 'C',
    });
    expect(resolved.source).toBe('catalog');
    expect(resolved.modelName).toBe('Landcruising Core 2 HS');
    expect(resolved.modelStrengthClass).toEqual({ value: 'B', origin: 'slackdata' });
    expect(resolved.personalStrengthClass).toBe('C');
    expect(resolved.recommendedLifetimeDays).toBeNull();
    expect(resolved.legacyImageUrl).toBeNull();
  });

  it('keeps legacy gear resolving from its local model unchanged', () => {
    const resolved = resolveWebbingSpecs({
      catalog_snapshot: null,
      model: legacyModel,
      strength_class: null,
    });
    expect(resolved.source).toBe('legacy');
    expect(resolved.modelName).toBe('Brasileirinha');
    expect(resolved.materials).toEqual(['polyester']);
    expect(resolved.modelStrengthClass).toEqual({ value: 'A', origin: 'legacy' });
    expect(resolved.recommendedLifetimeDays).toBe(720);
    expect(resolved.legacyImageUrl).toBe('models/brasileirinha.png');
  });

  it('reports manual gear as unknown, keeping personal strength separate', () => {
    const resolved = resolveWebbingSpecs({ strength_class: 'A+' });
    expect(resolved.source).toBe('unknown');
    expect(resolved.modelStrengthClass).toBeNull();
    expect(resolved.personalStrengthClass).toBe('A+');
    expect(resolved.recommendedLifetimeDays).toBeNull();
  });

  it('marks an unreadable stored snapshot unsupported instead of casting it', () => {
    const resolved = resolveWebbingSpecs({
      catalog_snapshot: { ...snapshot, schemaVersion: 9 },
    });
    expect(resolved.source).toBe('unsupported');
    expect(resolved.catalog).toBeNull();
  });
});

describe('getWebbingDisplayName', () => {
  const snapshot = normalize(upstream).snapshot;

  it('uses label, then snapshot name, then legacy name', () => {
    expect(
      getWebbingDisplayName({ tag_name: 'Red line', catalog_snapshot: snapshot }),
    ).toBe('Red line');
    expect(getWebbingDisplayName({ tag_name: '', catalog_snapshot: snapshot })).toBe(
      'Landcruising Core 2 HS',
    );
    expect(
      getWebbingDisplayName({
        tag_name: null,
        model: { name: 'Legacy', material: 'nylon', weave: 'flat' },
      }),
    ).toBe('Legacy');
    expect(getWebbingDisplayName({ tag_name: null })).toBeNull();
    expect(getWebbingDisplayName(null)).toBeNull();
  });
});
