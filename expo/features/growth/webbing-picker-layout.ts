import type { ExperimentStorage } from './map-default';

export const WEBBING_PICKER_EXPERIMENT = 'webbing-picker-layout-v1';
export const WEBBING_PICKER_ASSIGNMENT_KEY = `experiment:${WEBBING_PICKER_EXPERIMENT}`;

/** `control` = two-column spec tiles; `wide` = one-column wide cards. */
export type WebbingPickerVariant = 'control' | 'wide';
export type WebbingPickerLayout = 'tiles' | 'wide';
export type WebbingPickerAssignment = { variant: WebbingPickerVariant };
export type WebbingPickerExperiment = {
  layout: WebbingPickerLayout;
  assignment: WebbingPickerAssignment | null;
};

/** Unassigned, unavailable, or failed: tiles, excluded from analysis. */
export const WEBBING_PICKER_FALLBACK: WebbingPickerExperiment = {
  layout: 'tiles',
  assignment: null,
};

export function isWebbingPickerVariant(
  value: unknown,
): value is WebbingPickerVariant {
  return value === 'control' || value === 'wide';
}

/**
 * Sticky enrollment: the first valid remote variant is persisted and reused,
 * so later flag changes never move an installation between layouts.
 */
export async function resolveWebbingPickerLayout(
  storage: ExperimentStorage,
  getVariant: () => Promise<unknown>,
): Promise<WebbingPickerExperiment> {
  try {
    const saved = await storage.getItem(WEBBING_PICKER_ASSIGNMENT_KEY);
    let variant = isWebbingPickerVariant(saved) ? saved : null;
    if (!variant) {
      const remote = await getVariant();
      // Missing config, an inactive flag, or a stopped experiment: no enrollment.
      if (!isWebbingPickerVariant(remote)) return WEBBING_PICKER_FALLBACK;
      // If persistence fails, don't serve a layout that could change next time.
      await storage.setItem(WEBBING_PICKER_ASSIGNMENT_KEY, remote);
      variant = remote;
    }
    return {
      layout: variant === 'wide' ? 'wide' : 'tiles',
      assignment: { variant },
    };
  } catch {
    return WEBBING_PICKER_FALLBACK;
  }
}

type Properties = Record<string, string | number | boolean>;
type Capture = (event: string, properties: Properties) => void;

export function webbingPickerExperimentProperties(
  experiment: WebbingPickerExperiment,
): Properties {
  return {
    experiment: WEBBING_PICKER_EXPERIMENT,
    experiment_eligible: experiment.assignment !== null,
    layout: experiment.layout,
    ...(experiment.assignment
      ? {
          variant: experiment.assignment.variant,
          [`$feature/${WEBBING_PICKER_EXPERIMENT}`]:
            experiment.assignment.variant,
        }
      : {}),
  };
}

export type PickerOutcome = 'catalog' | 'manual' | 'dismissed';

/**
 * One presentation of the picker sheet. Exposure is recorded when catalog
 * cards first become visible; a sheet that never shows the catalog (offline,
 * outage, empty) is not an exposure. No search text or names are sent.
 */
export class WebbingPickerSession {
  private openedAt: number;
  private exposedAt: number | null = null;
  private searched = false;
  private sorted = false;
  private filterCount = 0;
  private closed = false;
  private properties: Properties;

  constructor(
    experiment: WebbingPickerExperiment,
    private capture: Capture,
    private now: () => number = Date.now,
  ) {
    this.openedAt = now();
    this.properties = webbingPickerExperimentProperties(experiment);
  }

  private emit(event: string, properties: Properties = {}) {
    if (this.closed) return;
    this.capture(event, { ...this.properties, ...properties });
  }

  private seconds(from: number | null) {
    return from === null ? -1 : Math.round((this.now() - from) / 100) / 10;
  }

  expose(resultCount: number) {
    if (this.exposedAt !== null || resultCount <= 0) return;
    this.exposedAt = this.now();
    this.emit('webbing_picker_exposed', { result_count: resultCount });
  }

  search(query: string) {
    if (query.trim()) this.searched = true;
  }

  sort(key: string, desc: boolean) {
    this.sorted = true;
    this.emit('webbing_picker_sorted', {
      sort_key: key,
      sort_direction: desc ? 'desc' : 'asc',
    });
  }

  filter(filter: string, enabled: boolean, activeCount: number) {
    this.filterCount = activeCount;
    this.emit('webbing_picker_filtered', {
      filter,
      enabled,
      filter_count: activeCount,
    });
  }

  /** `position` is 1-based within the list the user saw. */
  select(position: number, sort: { key: string; desc: boolean }) {
    this.emit('webbing_picker_model_selected', {
      model_source: 'catalog',
      position,
      sort_key: sort.key,
      sort_direction: sort.desc ? 'desc' : 'asc',
      filter_count: this.filterCount,
      searched: this.searched,
      seconds_since_exposure: this.seconds(this.exposedAt),
    });
    this.close('catalog');
  }

  chooseManual() {
    this.emit('webbing_picker_manual_chosen', {
      seconds_since_exposure: this.seconds(this.exposedAt),
    });
    this.close('manual');
  }

  /** Idempotent; the first outcome wins. */
  close(outcome: PickerOutcome = 'dismissed') {
    if (this.closed) return;
    this.emit('webbing_picker_closed', {
      outcome,
      exposed: this.exposedAt !== null,
      seconds_open: this.seconds(this.openedAt),
      searched: this.searched,
      sorted: this.sorted,
      filter_count: this.filterCount,
    });
    this.closed = true;
  }
}

/** Registration outcome, attributed to the installation's picker cohort. */
export function captureWebbingRegistered(
  capture: Capture,
  experiment: WebbingPickerExperiment,
  details: { modelSource: 'catalog' | 'manual'; hasPhoto: boolean },
) {
  capture('webbing_registered', {
    ...webbingPickerExperimentProperties(experiment),
    model_source: details.modelSource,
    has_photo: details.hasPhoto,
  });
}
