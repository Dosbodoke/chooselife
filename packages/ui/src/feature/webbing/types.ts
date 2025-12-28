import type { Database } from '@chooselife/database';

export type WebbingModel = Database['public']['Tables']['webbing_model']['Row'];
export type Webbing = Database['public']['Tables']['webbing']['Row'];
export type RigSetup = Database['public']['Tables']['rig_setup']['Row'];
export type RigSetupWebbing =
  Database['public']['Tables']['rig_setup_webbing']['Row'];

export type StrengthClass = 'A+' | 'A' | 'B' | 'C';

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
