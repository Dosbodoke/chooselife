import { NavigationContainer } from '@react-navigation/native';
import { PreloadedState } from '@reduxjs/toolkit';
import type { AppStore, RootState } from '@src/redux/store';
import { setupStore } from '@src/redux/store';
import { render } from '@testing-library/react-native';
import type { RenderOptions } from '@testing-library/react-native';
import { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: PreloadedState<RootState>;
  store?: AppStore;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    // Automatically create a store instance if no store was passed in
    store = setupStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {}
) {
  function Wrapper({ children }: PropsWithChildren<object>): JSX.Element {
    return (
      <Provider store={store}>
        <NavigationContainer>{children}</NavigationContainer>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export const createTestProps = (props: object) => ({
  navigation: {
    navigate: jest.fn(),
    goBack: jest.fn(),
  },
  ...props,
});
