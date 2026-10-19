import type { ExperimentStorage } from './map-default';
import {
  captureWebbingRegistered,
  resolveWebbingPickerLayout,
  WEBBING_PICKER_ASSIGNMENT_KEY,
  WEBBING_PICKER_EXPERIMENT,
  WEBBING_PICKER_FALLBACK,
  WebbingPickerSession,
  type WebbingPickerExperiment,
} from './webbing-picker-layout';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
  } satisfies ExperimentStorage & { data: Map<string, string> };
}

describe('resolveWebbingPickerLayout', () => {
  it('enrolls with the remote variant and persists it', async () => {
    const storage = memoryStorage();
    await expect(
      resolveWebbingPickerLayout(storage, async () => 'wide'),
    ).resolves.toEqual({ layout: 'wide', assignment: { variant: 'wide' } });
    expect(storage.data.get(WEBBING_PICKER_ASSIGNMENT_KEY)).toBe('wide');
  });

  it('keeps the first assignment even if the flag later changes', async () => {
    const storage = memoryStorage({
      [WEBBING_PICKER_ASSIGNMENT_KEY]: 'control',
    });
    const getVariant = jest.fn(async () => 'wide');
    await expect(
      resolveWebbingPickerLayout(storage, getVariant),
    ).resolves.toEqual({
      layout: 'tiles',
      assignment: { variant: 'control' },
    });
    expect(getVariant).not.toHaveBeenCalled();
  });

  it.each([undefined, false, 'test', 'tiles'])(
    'falls back to unenrolled tiles for remote value %p',
    async (remote) => {
      const storage = memoryStorage();
      await expect(
        resolveWebbingPickerLayout(storage, async () => remote),
      ).resolves.toEqual(WEBBING_PICKER_FALLBACK);
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('does not serve a variant it could not persist', async () => {
    const storage = memoryStorage();
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      resolveWebbingPickerLayout(storage, async () => 'wide'),
    ).resolves.toEqual(WEBBING_PICKER_FALLBACK);
  });

  it('falls back when storage or the flag request throws', async () => {
    const storage = memoryStorage();
    storage.getItem.mockRejectedValueOnce(new Error('locked'));
    await expect(
      resolveWebbingPickerLayout(storage, async () => 'wide'),
    ).resolves.toEqual(WEBBING_PICKER_FALLBACK);
    await expect(
      resolveWebbingPickerLayout(memoryStorage(), async () => {
        throw new Error('offline');
      }),
    ).resolves.toEqual(WEBBING_PICKER_FALLBACK);
  });
});

describe('WebbingPickerSession', () => {
  const enrolled: WebbingPickerExperiment = {
    layout: 'wide',
    assignment: { variant: 'wide' },
  };

  function session(experiment = enrolled) {
    let clock = 1_000;
    const capture = jest.fn();
    const s = new WebbingPickerSession(experiment, capture, () => clock);
    return {
      s,
      capture,
      advance: (ms: number) => {
        clock += ms;
      },
      events: () => capture.mock.calls.map(([event]) => event),
    };
  }

  it('tags every event with the cohort', () => {
    const { s, capture } = session();
    s.expose(12);
    expect(capture).toHaveBeenCalledWith('webbing_picker_exposed', {
      experiment: WEBBING_PICKER_EXPERIMENT,
      experiment_eligible: true,
      layout: 'wide',
      variant: 'wide',
      [`$feature/${WEBBING_PICKER_EXPERIMENT}`]: 'wide',
      result_count: 12,
    });
  });

  it('marks unenrolled sessions ineligible without a variant', () => {
    const { s, capture } = session(WEBBING_PICKER_FALLBACK);
    s.expose(3);
    const properties = capture.mock.calls[0][1];
    expect(properties).toMatchObject({
      experiment_eligible: false,
      layout: 'tiles',
    });
    expect(properties).not.toHaveProperty('variant');
    expect(properties).not.toHaveProperty(
      `$feature/${WEBBING_PICKER_EXPERIMENT}`,
    );
  });

  it('exposes once, only when catalog cards are visible', () => {
    const { s, events } = session();
    s.expose(0);
    s.expose(5);
    s.expose(5);
    expect(events()).toEqual(['webbing_picker_exposed']);
  });

  it('records a selection with context and closes once', () => {
    const { s, capture, advance, events } = session();
    s.search('  ');
    advance(500);
    s.expose(10);
    s.sort('strength', true);
    s.filter('material:Nylon', true, 1);
    s.search('raed');
    advance(4_200);
    s.select(3, { key: 'strength', desc: true });
    s.close('dismissed');
    s.sort('width', false);

    expect(events()).toEqual([
      'webbing_picker_exposed',
      'webbing_picker_sorted',
      'webbing_picker_filtered',
      'webbing_picker_model_selected',
      'webbing_picker_closed',
    ]);
    expect(capture.mock.calls[3][1]).toMatchObject({
      model_source: 'catalog',
      position: 3,
      sort_key: 'strength',
      sort_direction: 'desc',
      filter_count: 1,
      searched: true,
      seconds_since_exposure: 4.2,
    });
    expect(capture.mock.calls[4][1]).toMatchObject({
      outcome: 'catalog',
      exposed: true,
      seconds_open: 4.7,
      sorted: true,
    });
    expect(JSON.stringify(capture.mock.calls)).not.toContain('raed');
  });

  it('reports manual entry and dismissals without exposure', () => {
    const manual = session();
    manual.s.chooseManual();
    expect(manual.events()).toEqual([
      'webbing_picker_manual_chosen',
      'webbing_picker_closed',
    ]);
    expect(manual.capture.mock.calls[0][1]).toMatchObject({
      seconds_since_exposure: -1,
    });
    expect(manual.capture.mock.calls[1][1]).toMatchObject({
      outcome: 'manual',
      exposed: false,
    });

    const dismissed = session();
    dismissed.s.close();
    expect(dismissed.capture.mock.calls[0][1]).toMatchObject({
      outcome: 'dismissed',
    });
  });
});

describe('captureWebbingRegistered', () => {
  it('attributes the registration to the cohort', () => {
    const capture = jest.fn();
    captureWebbingRegistered(
      capture,
      { layout: 'tiles', assignment: { variant: 'control' } },
      { modelSource: 'catalog', hasPhoto: true },
    );
    expect(capture).toHaveBeenCalledWith('webbing_registered', {
      experiment: WEBBING_PICKER_EXPERIMENT,
      experiment_eligible: true,
      layout: 'tiles',
      variant: 'control',
      [`$feature/${WEBBING_PICKER_EXPERIMENT}`]: 'control',
      model_source: 'catalog',
      has_photo: true,
    });
  });
});
