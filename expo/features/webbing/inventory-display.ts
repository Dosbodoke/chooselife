import type {
  ResolvedWebbingSpecs,
  WebbingLifetimeStatus,
  WebbingUsage,
} from '@chooselife/ui';

/**
 * What a row says about use. Against a lifetime it is a gauge with a verdict;
 * without one, plain counts. A piece never rigged and without a lifetime
 * says nothing, so a fresh collection stays compact.
 */
export type UsageSummary =
  | {
      kind: 'lifetime';
      usageDays: number;
      rigCount: number;
      lifetimeDays: number;
      /** 0–100: overuse fills the gauge, the verdict says the rest. */
      percentUsed: number;
      status: WebbingLifetimeStatus;
    }
  | { kind: 'counts'; usageDays: number; rigCount: number };

export function summarizeUsage(
  usage: WebbingUsage | null | undefined,
): UsageSummary | null {
  if (!usage) return null;
  const { usageDays, rigCount, recommendedLifetimeDays, percentageUsed } =
    usage;
  if (recommendedLifetimeDays && percentageUsed !== null)
    return {
      kind: 'lifetime',
      usageDays,
      rigCount,
      lifetimeDays: recommendedLifetimeDays,
      percentUsed: Math.max(0, Math.min(100, percentageUsed)),
      status: usage.status,
    };
  if (!usageDays && !rigCount) return null;
  return { kind: 'counts', usageDays, rigCount };
}

/** One fact about a model, shown as its own chip. */
export type ModelSpec =
  | { kind: 'class'; value: string }
  | { kind: 'material'; value: string }
  | { kind: 'construction'; value: string };

/**
 * A model heading's facts, class first. Each material stands alone, since
 * names like "Dyneema/HMPE" already contain a slash.
 */
export function modelSpecs({
  modelStrengthClass,
  materials,
  construction,
}: ResolvedWebbingSpecs): ModelSpec[] {
  return [
    ...(modelStrengthClass
      ? [{ kind: 'class', value: modelStrengthClass.value } as const]
      : []),
    ...(materials ?? []).map((value) => ({ kind: 'material', value }) as const),
    ...(construction
      ? [{ kind: 'construction', value: construction } as const]
      : []),
  ];
}
