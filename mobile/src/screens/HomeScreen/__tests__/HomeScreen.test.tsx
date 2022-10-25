/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/display-name */

import { renderWithProviders, createTestProps } from '@src/utils/test-utils';

import ClusteredMap from '../ClusteredMap/ClusteredMap';
import HomeScreen from '../HomeScreen';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockMapView = React.forwardRef(({ testID, children, ...props }: any, ref: any) => {
    if (ref?.current) {
      ref.current = {
        getMapBoundaries: async () => ({
          northEast: {
            latitude: 2,
            longitude: 2,
          },
          southWest: {
            latitude: 1,
            longitude: 1,
          },
        }),
        getCamera: async () => ({
          center: {
            latitude: 2,
            longitude: 2,
          },
          heading: 1,
          pitch: 1,
          zoom: 1,
          altitude: 1,
        }),
        animateCamera: () => {},
      };
    }

    return (
      <View testID={testID} {...props}>
        {children}
      </View>
    );
  });

  const MockMarker = React.forwardRef(({ testID, children, ...props }: any, ref: any) => {
    if (ref?.current) {
      ref.current = {
        redraw: () => {},
      };
    }

    return (
      <View testID={testID} {...props}>
        {children}
      </View>
    );
  });

  const mockMapTypes = {
    STANDARD: 0,
    SATELLITE: 1,
    HYBRID: 2,
    TERRAIN: 3,
    NONE: 4,
    MUTEDSTANDARD: 5,
  };

  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    MAP_TYPES: mockMapTypes,
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});

describe('HomeScreen', () => {
  describe('Map', () => {
    it('Match snapshot', () => {
      // when
      const tree = renderWithProviders(<ClusteredMap buttonMarginBottom={240} />).toJSON();

      // then
      expect(tree).toMatchSnapshot();
    });

    it('Render the map', () => {
      // given
      const props: any = createTestProps({});

      // when
      const { getByTestId } = renderWithProviders(<HomeScreen {...props} />);
      const map = getByTestId('MapView');

      // then
      expect(map).toBeDefined();
    });
  });
});
