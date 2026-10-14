import { ExploreVisit } from './explore-visit';

function setup(eligible = true) {
  let time = 0;
  const capture = jest.fn();
  const visit = new ExploreVisit(
    {
      mapType: 'satellite',
      assignment: eligible ? { variant: 'control' } : null,
    },
    capture,
    () => time,
  );
  const advance = (milliseconds: number) => {
    time += milliseconds;
  };
  const seconds = () =>
    capture.mock.calls
      .filter(([event]) => event === 'explore_engagement')
      .reduce((sum, [, props]) => sum + props.active_seconds, 0);
  return { visit, capture, advance, seconds };
}

describe('Explore engagement measurement', () => {
  it('records exposure once per visit and never for an excluded visitor', () => {
    const { visit, capture } = setup();
    visit.flush();
    expect(
      capture.mock.calls.filter(
        ([event]) => event === 'explore_map_experiment_exposed',
      ),
    ).toHaveLength(1);
    expect(
      setup(false).capture.mock.calls.some(
        ([event]) => event === 'explore_map_experiment_exposed',
      ),
    ).toBe(false);
  });

  it('sends non-overlapping heartbeat deltas and caps idle time', () => {
    const { visit, advance, seconds } = setup();
    advance(15_000);
    visit.flush();
    advance(15_000);
    visit.flush();
    advance(600_000);
    visit.flush();
    expect(seconds()).toBe(30);
  });

  it('resumes time at the interaction instead of counting the idle gap', () => {
    const { visit, advance, seconds } = setup();
    advance(100_000);
    visit.interact();
    advance(10_000);
    visit.end();
    expect(seconds()).toBe(40);
  });

  it('does not create an event for every touch', () => {
    const { visit, advance, capture, seconds } = setup();
    for (let i = 0; i < 100; i++) {
      advance(100);
      visit.interact();
    }
    expect(capture).toHaveBeenCalledTimes(2);
    visit.flush();
    expect(seconds()).toBe(10);
  });

  it('attributes switches and conversions to the original variant', () => {
    const { visit, advance, capture } = setup();
    advance(10_000);
    visit.changeMapType('standard');
    advance(5_000);
    visit.openHighline('map_card');
    visit.end();
    expect(capture).toHaveBeenCalledWith(
      'explore_highline_opened',
      expect.objectContaining({
        source: 'map_card',
        map_type: 'standard',
        variant: 'control',
        '$feature/explore-map-default-v1': 'control',
      }),
    );
    expect(capture).toHaveBeenCalledWith(
      'explore_engagement',
      expect.objectContaining({ map_type: 'satellite', active_seconds: 10 }),
    );
    expect(capture).toHaveBeenCalledWith(
      'explore_engagement',
      expect.objectContaining({ map_type: 'standard', active_seconds: 5 }),
    );
  });

  it('ends exactly once and counts no background or unmounted time', () => {
    const { visit, advance, capture, seconds } = setup();
    advance(5_000);
    visit.end();
    advance(50_000);
    visit.end();
    visit.interact();
    visit.openHighline('list');
    visit.flush();
    expect(seconds()).toBe(5);
    expect(
      capture.mock.calls.filter(([event]) => event === 'explore_visit_ended'),
    ).toHaveLength(1);
    expect(
      capture.mock.calls.some(([event]) => event === 'explore_highline_opened'),
    ).toBe(false);
  });
});
