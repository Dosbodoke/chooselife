import {
  buildWebbingUsage,
  normalizeSlackDataWebbing,
  resolveWebbingSpecs,
} from '@chooselife/ui';

import { modelSpecs, summarizeUsage } from './inventory-display';

describe('summarizeUsage', () => {
  it('fills the gauge for an overused piece and keeps the real counts', () => {
    // A SKY 2.0 rigged for longer than its 540-day lifetime.
    expect(summarizeUsage(buildWebbingUsage(612, 140, 540))).toEqual({
      kind: 'lifetime',
      usageDays: 612,
      rigCount: 140,
      lifetimeDays: 540,
      percentUsed: 100,
      status: 'replace',
    });
  });

  it('shows the gauge for an unused piece with a lifetime', () => {
    expect(summarizeUsage(buildWebbingUsage(0, 0, 540))).toMatchObject({
      kind: 'lifetime',
      percentUsed: 0,
      status: 'good',
    });
  });

  it('counts days and rigs when there is no lifetime to compare', () => {
    expect(summarizeUsage(buildWebbingUsage(1284, 1, null))).toEqual({
      kind: 'counts',
      usageDays: 1284,
      rigCount: 1,
    });
  });

  it('says nothing for a piece never rigged and without a lifetime', () => {
    expect(summarizeUsage(buildWebbingUsage(0, 0, null))).toBeNull();
    expect(summarizeUsage(null)).toBeNull();
  });
});

describe('modelSpecs', () => {
  it('splits every material into its own fact after the class', () => {
    const result = normalizeSlackDataWebbing(
      {
        id: 1,
        name: 'Spider Silk',
        isa_class: 'A+',
        material: ['Dyneema/HMPE', 'Polyester', 'Nylon', 'Vectran'],
        webbing_construction: 'Tubular/flat hybrid',
      },
      '2026-11-11T00:00:00.000Z',
    );
    if (!result.ok) throw new Error('Invalid fixture');

    expect(
      modelSpecs(resolveWebbingSpecs({ catalog_snapshot: result.snapshot })),
    ).toEqual([
      { kind: 'class', value: 'A+' },
      { kind: 'material', value: 'Dyneema/HMPE' },
      { kind: 'material', value: 'Polyester' },
      { kind: 'material', value: 'Nylon' },
      { kind: 'material', value: 'Vectran' },
      { kind: 'construction', value: 'Tubular/flat hybrid' },
    ]);
  });

  it('never presents an owner-entered class as a model fact', () => {
    expect(modelSpecs(resolveWebbingSpecs({ strength_class: 'A' }))).toEqual(
      [],
    );
  });
});
