import { compareVersions, isVersionLessThan } from '../utils/version';

describe('version utilities', () => {
  describe('compareVersions', () => {
    it('returns 0 when versions are equal', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('2.5.3', '2.5.3')).toBe(0);
      expect(compareVersions('10.20.30', '10.20.30')).toBe(0);
    });

    it('returns -1 when first version is less than second', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
      expect(compareVersions('1.3.14', '1.4.0')).toBe(-1);
    });

    it('returns 1 when first version is greater than second', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(compareVersions('1.4.0', '1.3.14')).toBe(1);
    });

    it('handles versions with different number of parts', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.0', '1.0')).toBe(0);
      expect(compareVersions('1', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.1', '1.0')).toBe(1);
      expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    });

    it('handles undefined or empty values safely', () => {
      // If current version is undefined but min version exists, treat as needing update
      expect(compareVersions(undefined, '1.0.0')).toBe(-1);
      // If min version is undefined but current exists, no update needed
      expect(compareVersions('1.0.0', undefined)).toBe(1);
      // Both undefined means equal (no update check possible)
      expect(compareVersions(undefined, undefined)).toBe(0);
      // Empty strings treated same as undefined
      expect(compareVersions('', '1.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '')).toBe(1);
      expect(compareVersions('  ', '1.0.0')).toBe(-1);
    });

    it('handles multi-digit version numbers', () => {
      expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
      expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
      expect(compareVersions('10.0.0', '9.0.0')).toBe(1);
      expect(compareVersions('1.0.100', '1.0.99')).toBe(1);
    });
  });

  describe('isVersionLessThan', () => {
    it('returns true when first version is less than second', () => {
      expect(isVersionLessThan('1.0.0', '2.0.0')).toBe(true);
      expect(isVersionLessThan('1.3.14', '1.4.0')).toBe(true);
      expect(isVersionLessThan('1.3.14', '2.0.0')).toBe(true);
    });

    it('returns false when first version is equal to second', () => {
      expect(isVersionLessThan('1.0.0', '1.0.0')).toBe(false);
      expect(isVersionLessThan('1.3.14', '1.3.14')).toBe(false);
    });

    it('returns false when first version is greater than second', () => {
      expect(isVersionLessThan('2.0.0', '1.0.0')).toBe(false);
      expect(isVersionLessThan('1.4.0', '1.3.14')).toBe(false);
    });

    it('handles undefined values safely for update checks', () => {
      // Undefined current version with valid min version = needs update
      expect(isVersionLessThan(undefined, '1.0.0')).toBe(true);
      // Valid current version with undefined min = no update needed
      expect(isVersionLessThan('1.0.0', undefined)).toBe(false);
      // Both undefined = no update needed
      expect(isVersionLessThan(undefined, undefined)).toBe(false);
    });
  });
});
