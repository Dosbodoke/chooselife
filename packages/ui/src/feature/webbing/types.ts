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

export interface WebbingUsage {
  usageDays: number;
  rigCount: number;
  recommendedLifetimeDays: number | null;
  percentageUsed: number;
  status: WebbingLifetimeStatus;
}

export type WebbingLifetimeStatus = 'good' | 'inspect' | 'replace';

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
