/**
 * Compares two semantic version strings.
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 *
 * Edge cases:
 * - If both are undefined/empty: returns 0 (equal)
 * - If only 'a' is undefined: returns -1 (a < b, triggers update)
 * - If only 'b' is undefined: returns 1 (a > b, no update needed)
 */
export function compareVersions(a: string | undefined, b: string | undefined): number {
  const aEmpty = !a || a.trim() === '';
  const bEmpty = !b || b.trim() === '';

  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return -1; // No current version means update needed
  if (bEmpty) return 1; // No min version means no update needed

  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Checks if version a is less than version b.
 * Returns true if current version is below minimum required version.
 */
export function isVersionLessThan(a: string | undefined, b: string | undefined): boolean {
  return compareVersions(a, b) < 0;
}
