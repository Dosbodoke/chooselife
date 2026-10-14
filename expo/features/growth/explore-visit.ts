import {
  MAP_DEFAULT_EXPERIMENT,
  type MapDefault,
  type MapType,
} from './map-default';

type Properties = Record<string, string | number | boolean>;
type Capture = (event: string, properties: Properties) => void;
const IDLE_AFTER_MS = 30_000;

/** One visible, foreground visit. Heartbeats report deltas, never cumulative time. */
export class ExploreVisit {
  private lastInteraction: number;
  private lastFlush: number;
  private ended = false;
  private pendingMs = 0;
  private mapType: MapType;
  private properties: Properties;

  constructor(
    state: MapDefault,
    private capture: Capture,
    private now: () => number = Date.now,
  ) {
    this.lastInteraction = this.lastFlush = now();
    this.mapType = state.mapType;
    this.properties = {
      experiment: MAP_DEFAULT_EXPERIMENT,
      experiment_eligible: state.assignment !== null,
      ...(state.assignment
        ? {
            variant: state.assignment.variant,
            [`$feature/${MAP_DEFAULT_EXPERIMENT}`]: state.assignment.variant,
          }
        : {}),
    };
    if (state.assignment) this.emit('explore_map_experiment_exposed');
    this.emit('explore_viewed');
  }

  private emit(event: string, properties: Properties = {}) {
    this.capture(event, {
      ...this.properties,
      map_type: this.mapType,
      ...properties,
    });
  }

  interact() {
    if (this.ended) return;
    this.accrue();
    this.lastInteraction = this.now();
  }

  private accrue() {
    const now = this.now();
    const activeMs = Math.max(
      0,
      Math.min(now, this.lastInteraction + IDLE_AFTER_MS) - this.lastFlush,
    );
    this.lastFlush = now;
    this.pendingMs += activeMs;
  }

  flush() {
    if (this.ended) return;
    this.accrue();
    if (this.pendingMs > 0)
      this.emit('explore_engagement', {
        active_seconds: this.pendingMs / 1000,
      });
    this.pendingMs = 0;
  }

  openHighline(source: 'list' | 'map_card') {
    if (this.ended) return;
    this.interact();
    this.emit('explore_highline_opened', { source });
  }

  changeMapType(next: MapType) {
    if (this.ended || next === this.mapType) return;
    this.interact();
    this.flush();
    this.emit('explore_map_style_changed', {
      from_map_type: this.mapType,
      to_map_type: next,
    });
    this.mapType = next;
  }

  end() {
    if (this.ended) return;
    this.flush();
    this.ended = true;
    this.emit('explore_visit_ended');
  }
}
