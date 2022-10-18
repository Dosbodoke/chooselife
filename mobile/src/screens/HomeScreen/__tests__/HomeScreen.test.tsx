/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/display-name */

import { render } from '@testing-library/react-native';
import { Region } from 'react-native-maps';
import renderer from 'react-test-renderer';

import ClusteredMapView from '../ClusteredMapView';
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

const createTestProps = (props: object) => ({
  navigation: {
    navigate: jest.fn(),
  },
  ...props,
});

describe('HomeScreen', () => {
  describe('Map', () => {
    it('Render the map', () => {
      // given
      const props: any = createTestProps({});

      // when
      const { getByTestId } = render(<HomeScreen {...props} />);
      const map = getByTestId('MapView');

      // then
      expect(map).toBeDefined();
    });

    it('Renders correctly', () => {
      // given
      const initialRegion: Region = {
        latitude: -15.7782081,
        longitude: -47.93371,
        latitudeDelta: 5,
        longitudeDelta: 5,
      };

      // when
      const tree = renderer.create(<ClusteredMapView initialRegion={initialRegion} />).toJSON();

      // then
      expect(tree).toMatchSnapshot();
    });
  });
});
