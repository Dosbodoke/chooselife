/* eslint-disable @typescript-eslint/no-explicit-any */

import { renderWithProviders, createTestProps } from '@src/utils/test-utils';
import { fireEvent, render, screen } from '@testing-library/react-native';

import useLastHighline, { type StorageHighline } from '@src/hooks/useLastHighline';
import SearchCard from '../SearchCard';

jest.mock('@src/hooks/useLastHighline', () => ({
  __esModule: true,
  default: jest.fn(),
}));

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

  it('Shows last 2 visited highlines', () => {
    // given
    const props: any = createTestProps({});
    const lastHighline: StorageHighline[] = [
      {
        uuid: '1',
        name: 'Pangaré Figueiredo',
        height: 15,
        length: 42,
        isRigged: false,
        coords: [
          { latitude: -15.782699598577715, longitude: -47.93240706636002 },
          { latitude: -15.782857045014248, longitude: -47.932031557107194 },
        ],
      },
      {
        uuid: '2',
        name: 'Varal de Cabaré',
        height: 24,
        length: 84,
        isRigged: true,
        coords: [
          { latitude: -16.40110401623181, longitude: -48.98699219976841 },
          { latitude: -16.39990690739436, longitude: -48.98303872861332 },
        ],
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
