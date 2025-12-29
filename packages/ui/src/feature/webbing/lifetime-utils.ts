import type { WebbingLifetimeStatus, WebbingUsage, TStrengthClass } from './types';

/**
 * ISA recommended lifetime days by strength class and material
 */
export const LIFETIME_DEFAULTS: Record<
  string,
  Record<TStrengthClass, number>
> = {
  nylon: {
    'A+': 720,
    A: 720,
    B: 360,
    C: 180,
  },
  polyester: {
    'A+': 720,
    A: 720,
    B: 540,
    C: 360,
  },
  dyneema: {
    'A+': 720,
    A: 720,
    B: 720,
    C: 540,
  },
};

/**
 * Get recommended lifetime days for a strength class
 * Uses polyester as default material (middle ground)
 */
export function getRecommendedLifetimeDays(
  strengthClass: TStrengthClass | null,
  material: string = 'polyester',
): number | null {
  if (!strengthClass) return null;
  return LIFETIME_DEFAULTS[material]?.[strengthClass] ?? null;
}

/**
 * Calculate lifetime status based on usage percentage
 * - good: < 75% used
 * - inspect: 75-90% used
 * - replace: >= 90% used
 */
export function getLifetimeStatus(
  usageDays: number,
  recommendedDays: number | null,
): WebbingLifetimeStatus {
  if (!recommendedDays || recommendedDays <= 0) return 'good';

  const percentage = (usageDays / recommendedDays) * 100;

  if (percentage >= 90) return 'replace';
  if (percentage >= 75) return 'inspect';
  return 'good';
}

/**
 * Calculate usage percentage (capped at 100%)
 */
export function getUsagePercentage(
  usageDays: number,
  recommendedDays: number | null,
): number {
  if (!recommendedDays || recommendedDays <= 0) return 0;
  return Math.min(100, (usageDays / recommendedDays) * 100);
}

/**
 * Calculate remaining days
 */
export function getRemainingDays(
  usageDays: number,
  recommendedDays: number | null,
): number | null {
  if (!recommendedDays) return null;
  return Math.max(0, recommendedDays - usageDays);
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: WebbingLifetimeStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'replace':
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-200',
      };
    case 'inspect':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case 'good':
    default:
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
      };
  }
}

/**
 * Build WebbingUsage object from raw data
 */
export function buildWebbingUsage(
  usageDays: number,
  rigCount: number,
  recommendedLifetimeDays: number | null,
): WebbingUsage {
  const status = getLifetimeStatus(usageDays, recommendedLifetimeDays);
  const percentageUsed = getUsagePercentage(usageDays, recommendedLifetimeDays);

  return {
    usageDays,
    rigCount,
    recommendedLifetimeDays,
    percentageUsed,
    status,
  };
}

// ============================================================================
// UI Color Helpers
// ============================================================================

/**
 * Get Tailwind classes for weave badge styling
 */
export function getWeaveColor(weave: string): string {
  const colorMap: Record<string, string> = {
    flat: 'bg-amber-100 text-amber-700',
    tubular: 'bg-rose-100 text-rose-700',
  };
  return colorMap[weave] || 'bg-gray-100 text-gray-700';
}

/**
 * Get Tailwind classes for material badge styling
 */
export function getMaterialColor(material: string): string {
  const colorMap: Record<string, string> = {
    nylon: 'bg-blue-100 text-blue-700',
    dyneema: 'bg-emerald-100 text-emerald-700',
    polyester: 'bg-violet-100 text-violet-700',
  };
  return colorMap[material] || 'bg-gray-100 text-gray-700';
}

/**
 * Get Tailwind class for material icon color
 */
export function getMaterialIconColor(material: string): string {
  const colorMap: Record<string, string> = {
    nylon: 'text-blue-500',
    dyneema: 'text-emerald-500',
    polyester: 'text-violet-500',
  };
  return colorMap[material] || 'text-gray-500';
}

/**
 * Get Tailwind classes for strength class badge styling
 */
export function getStrengthClassColor(strengthClass: string): string {
  const colorMap: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    A: 'bg-teal-100 text-teal-700 border-teal-200',
    B: 'bg-blue-100 text-blue-700 border-blue-200',
    C: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return colorMap[strengthClass] || 'bg-gray-100 text-gray-700 border-gray-200';
}
