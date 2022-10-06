/* eslint-disable */

import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../HomeScreen';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const React = require('react');

  const MockMapView = React.forwardRef(
    ({ testID, children, ...props }: any, ref: any) => {
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
    },
  );

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
    // given
    const props: any = createTestProps({});
    render(<HomeScreen {...props} />);
    const jsonScreen: any = screen.toJSON()
    const map = jsonScreen['children'].find((c: any) => 'region' in c.props)

    it('Render the map', () => {
      expect(map).toBeDefined();
    });

    it('Show user location', () => {
      expect(map.props.showsUserLocation).toEqual(true);
    });

    it('Uses google provider', () => {
      expect(map.props.provider).toEqual('google');
    });
  })

  it('Go to SearchScreen on click search component', () => {
    // given
    const props: any = createTestProps({});
    render(<HomeScreen {...props} />);
    const myLocation: any = screen.getByText('Procurar por um Highline').parent;

    // when
    fireEvent.press(myLocation);

    // then
    expect(props.navigation.navigate).toBeCalledWith('Search');
  });
});
