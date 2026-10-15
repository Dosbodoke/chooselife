/// <reference types="jest" />

import {
  buildWebbingUsage,
  deriveWebbingUsage,
  getLifetimeStatus,
  getRemainingDays,
  getStatusColor,
  getTranslatedStatus,
  getUsagePercentage,
} from './lifetime-utils';

describe('lifetime status', () => {
  it('keeps the existing thresholds for a supported lifetime', () => {
    expect(getLifetimeStatus(0, 720)).toBe('good');
    expect(getLifetimeStatus(539, 720)).toBe('good');
    expect(getLifetimeStatus(540, 720)).toBe('inspect');
    expect(getLifetimeStatus(647, 720)).toBe('inspect');
    expect(getLifetimeStatus(648, 720)).toBe('replace');
    expect(getLifetimeStatus(900, 720)).toBe('replace');
  });

  it('is unknown, never good, without a supported lifetime', () => {
    for (const lifetime of [null, 0, -10, Number.NaN, Infinity]) {
      expect(getLifetimeStatus(0, lifetime)).toBe('unknown');
      expect(getUsagePercentage(10, lifetime)).toBeNull();
      expect(getRemainingDays(10, lifetime)).toBeNull();
    }
  });

  it('maps unknown to neutral colors and labels in every locale', () => {
    expect(getStatusColor('unknown').bg).toBe('bg-slate-100');
    expect(getTranslatedStatus('unknown', 'en-US')).toBe('No estimate');
    expect(getTranslatedStatus('unknown', 'pt-BR')).toBe('Sem estimativa');
    expect(getTranslatedStatus('unknown', 'es')).toBe('Sin estimación');
  });
});

describe('buildWebbingUsage', () => {
  it('keeps recorded usage when the lifetime is unknown', () => {
    expect(buildWebbingUsage(42, 3, null)).toEqual({
      usageDays: 42,
      rigCount: 3,
      recommendedLifetimeDays: null,
      percentageUsed: null,
      remainingDays: null,
      status: 'unknown',
    });
  });

  it('caps percentage and remaining days for a supported lifetime', () => {
    expect(buildWebbingUsage(800, 9, 720)).toMatchObject({
      percentageUsed: 100,
      remainingDays: 0,
      status: 'replace',
    });
    expect(buildWebbingUsage(180, 2, 720)).toMatchObject({
      percentageUsed: 25,
      remainingDays: 540,
      status: 'good',
    });
  });
});

describe('deriveWebbingUsage', () => {
  it('is null while raw usage is unavailable rather than zero use', () => {
    expect(deriveWebbingUsage(undefined, 720)).toBeNull();
  });

  it('recomputes from the same cached record when lifetime metadata arrives', () => {
    const record = { usageDays: 600, rigCount: 4 };
    expect(deriveWebbingUsage(record, null)?.status).toBe('unknown');
    expect(deriveWebbingUsage(record, 720)?.status).toBe('inspect');
    expect(record).toEqual({ usageDays: 600, rigCount: 4 });
  });
});
