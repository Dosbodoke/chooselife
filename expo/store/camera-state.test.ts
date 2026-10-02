import type { BBox, Position } from 'geojson';

import {
  isCameraOnLocation,
  nextCameraState,
  type CameraChangeEvent,
  type CameraState,
} from './camera-state';

const buildPrevious = (zoom = 12): CameraState => ({
  zoom,
  center: [-47.93371, -15.7782081] as Position,
  bounds: [-48, -16, -47.8, -15.6] as BBox,
});

const buildEvent = (
  overrides: Partial<{
    center: Position;
    zoom: number;
    sw: Position;
    ne: Position;
  }> = {},
): CameraChangeEvent => ({
  properties: {
    center: overrides.center ?? [-47.93371, -15.7782081],
    zoom: overrides.zoom ?? 12,
    bounds: {
      sw: overrides.sw ?? [-48, -16],
      ne: overrides.ne ?? [-47.8, -15.6],
    },
  },
});

const sparseCenter: number[] = [10, 20, 300];
delete sparseCenter[2];

describe('nextCameraState', () => {
  describe('referential stability', () => {
    it('returns the exact previous object when nothing changed', () => {
      const previous = buildPrevious();

      expect(nextCameraState(previous, buildEvent())).toBe(previous);
    });

    it('returns the previous object for repeated identical events', () => {
      const previous = buildPrevious();

      const first = nextCameraState(previous, buildEvent());
      const second = nextCameraState(first, buildEvent());
      const third = nextCameraState(second, buildEvent());

      expect(first).toBe(previous);
      expect(second).toBe(previous);
      expect(third).toBe(previous);
    });

    it('ignores sub-epsilon float noise from the native payload', () => {
      const previous = buildPrevious();

      const noisy = nextCameraState(
        previous,
        buildEvent({
          center: [-47.93371 + 1e-9, -15.7782081 - 1e-9],
          zoom: 12 + 1e-7,
        }),
      );

      expect(noisy).toBe(previous);
    });

    it.each([
      ['upward crossing at 14', 14 - 4e-4, 14 + 5e-4],
      ['downward crossing at 14', 14 + 4e-4, 14 - 5e-4],
      ['upward crossing at 16', 16 - 4e-4, 16 + 5e-4],
      ['downward crossing at 16', 16 + 4e-4, 16 - 5e-4],
    ])(
      'keeps zoom bucket crossings under the epsilon threshold: %s',
      (_label, previousZoom, nextZoom) => {
        const previous = buildPrevious(previousZoom);

        const next = nextCameraState(previous, buildEvent({ zoom: nextZoom }));

        expect(next).not.toBe(previous);
        expect(next.zoom).toBe(nextZoom);
        expect(next.center).toBe(previous.center);
        expect(next.bounds).toBe(previous.bounds);
      },
    );

    it('returns the previous object for same-bucket jitter', () => {
      const previous = buildPrevious(14 + 4e-4);

      expect(nextCameraState(previous, buildEvent({ zoom: 14 + 5e-4 }))).toBe(
        previous,
      );
    });

    it('keeps the previous center array when only the zoom moved', () => {
      const previous = buildPrevious();

      const next = nextCameraState(previous, buildEvent({ zoom: 14 }));

      expect(next).not.toBe(previous);
      expect(next.zoom).toBe(14);
      expect(next.center).toBe(previous.center);
    });

    it('keeps the previous bounds array when only the center moved', () => {
      const previous = buildPrevious();

      const next = nextCameraState(
        previous,
        buildEvent({ center: [-40, -10] }),
      );

      expect(next).not.toBe(previous);
      expect(next.bounds).toBe(previous.bounds);
      expect(next.center).toEqual([-40, -10]);
    });

    it('keeps the previous zoom value when only the viewport moved', () => {
      const previous = buildPrevious();

      const next = nextCameraState(
        previous,
        buildEvent({ sw: [-49, -17], ne: [-46, -14] }),
      );

      expect(next).not.toBe(previous);
      expect(next.zoom).toBe(previous.zoom);
      expect(next.bounds).toEqual([-49, -17, -46, -14]);
    });
  });

  describe('real movement', () => {
    it('flattens sw/ne into a [west, south, east, north] bbox', () => {
      const next = nextCameraState(
        buildPrevious(),
        buildEvent({ sw: [-49, -17], ne: [-46, -14] }),
      );

      expect(next.bounds).toEqual([-49, -17, -46, -14]);
    });

    it('applies a move that crosses every threshold at once', () => {
      const previous = buildPrevious();

      const next = nextCameraState(
        previous,
        buildEvent({
          center: [10, 20],
          zoom: 3,
          sw: [9, 19],
          ne: [11, 21],
        }),
      );

      expect(next).toEqual({
        center: [10, 20],
        zoom: 3,
        bounds: [9, 19, 11, 21],
      });
    });

    it('accepts a move just above the coordinate epsilon', () => {
      const previous = buildPrevious();

      const next = nextCameraState(
        previous,
        buildEvent({ center: [-47.93371 + 1e-5, -15.7782081] }),
      );

      expect(next).not.toBe(previous);
      expect(next.center).not.toBe(previous.center);
    });

    it('preserves extra position members such as altitude', () => {
      const next = nextCameraState(
        buildPrevious(),
        buildEvent({ center: [10, 20, 300] }),
      );

      expect(next.center).toEqual([10, 20, 300]);
    });
  });

  describe('malformed payloads', () => {
    it.each([
      ['a missing properties bag', {} as CameraChangeEvent],
      ['a NaN zoom', { properties: { ...buildEvent().properties, zoom: NaN } }],
      [
        'a NaN center',
        { properties: { ...buildEvent().properties, center: [NaN, 1] } },
      ],
      [
        'a NaN extra center coordinate',
        {
          properties: {
            ...buildEvent().properties,
            center: [10, 20, NaN],
          },
        },
      ],
      [
        'an infinite extra center coordinate',
        {
          properties: {
            ...buildEvent().properties,
            center: [10, 20, Infinity],
          },
        },
      ],
      [
        'a nonnumeric extra center coordinate',
        {
          properties: {
            ...buildEvent().properties,
            center: [10, 20, '300'],
          },
        } as unknown as CameraChangeEvent,
      ],
      [
        'a sparse extra center coordinate',
        {
          properties: {
            ...buildEvent().properties,
            center: sparseCenter,
          },
        },
      ],
      [
        'missing bounds',
        {
          properties: {
            center: [1, 2],
            zoom: 5,
          },
        } as unknown as CameraChangeEvent,
      ],
      [
        'a malformed sw corner',
        {
          properties: {
            ...buildEvent().properties,
            bounds: { sw: [], ne: [-47.8, -15.6] },
          },
        } as unknown as CameraChangeEvent,
      ],
      [
        'a malformed extra bounds coordinate',
        {
          properties: {
            ...buildEvent().properties,
            bounds: {
              sw: [-40, -10, NaN],
              ne: [-47.8, -15.6],
            },
          },
        },
      ],
    ])('discards %s and keeps the previous camera', (_label, event) => {
      const previous = buildPrevious();

      expect(nextCameraState(previous, event as CameraChangeEvent)).toBe(
        previous,
      );
    });

    it('never writes a NaN into the stored camera', () => {
      const previous = buildPrevious();

      const next = nextCameraState(previous, {
        properties: { ...buildEvent().properties, zoom: NaN },
      });

      expect(Number.isNaN(next.zoom)).toBe(false);
    });
  });
});

describe('isCameraOnLocation', () => {
  const target: Position = [-47.93371, -15.7782081];

  it('is false with no target yet', () => {
    expect(isCameraOnLocation([0, 0], null)).toBe(false);
  });

  it('is true when the camera sits exactly on the target', () => {
    expect(isCameraOnLocation([...target] as Position, target)).toBe(true);
  });

  it('is true for the jitter at the tail of the flight', () => {
    expect(
      isCameraOnLocation([target[0] + 5e-5, target[1] - 5e-5], target),
    ).toBe(true);
  });

  it('is false part-way through the flight', () => {
    expect(isCameraOnLocation([-47.9, -15.7], target)).toBe(false);
  });

  it('is false once the user drags away', () => {
    expect(isCameraOnLocation([target[0] + 0.01, target[1]], target)).toBe(
      false,
    );
  });

  it('releases on either axis independently', () => {
    expect(isCameraOnLocation([target[0] + 0.01, target[1]], target)).toBe(
      false,
    );
    expect(isCameraOnLocation([target[0], target[1] + 0.01], target)).toBe(
      false,
    );
  });

  it('is false for a malformed camera centre', () => {
    expect(isCameraOnLocation([NaN, NaN], target)).toBe(false);
  });
});
