import type { Tables } from '@chooselife/database';

export type WebbingModel = Tables<'webbing_model'>;
export type Webbing = Tables<'webbing'>;
export type RigSetup = Tables<'rig_setup'>;
export type RigSetupWebbing = Tables<'rig_setup_webbing'>;


/**
 * Strength class options for UI selectors
 */
export const STRENGTH_CLASS_OPTIONS = ['A+', 'A', 'B', 'C'] as const;
export type TStrengthClass = (typeof STRENGTH_CLASS_OPTIONS)[number];

/** Recorded use from rig history, independent of any lifetime estimate. */
export interface WebbingUsageRecord {
  usageDays: number;
  rigCount: number;
}

export interface WebbingUsage extends WebbingUsageRecord {
  recommendedLifetimeDays: number | null;
  /** Null when there is no supported lifetime to compare against. */
  percentageUsed: number | null;
  remainingDays: number | null;
  status: WebbingLifetimeStatus;
}

/** `unknown` means no supported lifetime estimate, never "good". */
export type WebbingLifetimeStatus = 'good' | 'inspect' | 'replace' | 'unknown';

export interface WebbingRigHistory {
  setupId: number;
  highlineId: string;
  highlineName: string;
  rigDate: string;
  unriggedAt: string | null;
  durationDays: number;
  webbingType: 'main' | 'backup';
}

export interface WebbingWithUsage extends Omit<Webbing, 'model'> {
  model: WebbingModel | null;
  usage: WebbingUsage | null;
}
