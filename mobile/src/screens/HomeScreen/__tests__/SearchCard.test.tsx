/* eslint-disable @typescript-eslint/no-explicit-any */

import { fireEvent, render, screen } from '@testing-library/react-native';

import SearchCard from '../SearchCard/SearchCard';
import useLastHighline, { ILastHighline } from '../SearchCard/useLastHighline';

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
    const lastHighline: ILastHighline[] = [
      { id: '1', name: 'High 1', height: 42, length: 15 },
      { id: '2', name: 'High 2', height: 22, length: 10 },
    ];
    (useLastHighline as jest.Mock).mockReturnValue(lastHighline);

    // when
    render(<SearchCard {...props} />);

    // then
    expect(screen.getByText('High 1')).toBeTruthy();
    expect(screen.getByText('High 2')).toBeTruthy();
  });
});
