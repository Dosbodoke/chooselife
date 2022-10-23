/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Highline } from '@src/database';
import { renderWithProviders } from '@src/utils/test-utils';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SearchCard from '../SearchCard/SearchCard';
import useLastHighline from '../SearchCard/useLastHighline';

jest.mock('../SearchCard/useLastHighline', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const createTestProps = (props: object) => ({
  navigation: {
    navigate: jest.fn(),
  },
  ...props,
});

describe('SearchCard', () => {
  it('Go to SearchScreen on click search bar', () => {
    // given
    const props: any = createTestProps({});

    // when
    render(<SearchCard {...props} />);
    const myLocation: any = screen.getByText('Encontre um Highline').parent;
    fireEvent.press(myLocation);

    // then
    expect(props.navigation.navigate).toBeCalledWith('Search');
  });

  it('Show last 2 visited highlines', () => {
    // given
    const props: any = createTestProps({});
    const lastHighline: Highline[] = [
      {
        id: '1',
        name: 'Pangaré Figueiredo',
        height: 15,
        length: 42,
        anchorA: { latitude: -15.782699598577715, longitude: -47.93240706636002 },
        anchorB: { latitude: -15.782857045014248, longitude: -47.932031557107194 },
      },
      {
        id: '2',
        name: 'Varal de Cabaré',
        height: 24,
        length: 84,
        anchorA: { latitude: -16.40110401623181, longitude: -48.98699219976841 },
        anchorB: { latitude: -16.39990690739436, longitude: -48.98303872861332 },
      },
    ];
    (useLastHighline as jest.Mock).mockReturnValue(lastHighline);

    // when
    renderWithProviders(<SearchCard {...props} />);

    // then
    expect(screen.getByText('Pangaré Figueiredo')).toBeTruthy();
    expect(screen.getByText('Varal de Cabaré')).toBeTruthy();
  });
});
