import { renderWithProviders, createTestProps } from '@src/utils/test-utils';
import { cleanup, screen, fireEvent } from '@testing-library/react-native';
import TextInput from './TextInput';

describe('TextInput', () => {
  afterEach(cleanup);

  beforeEach(() => {
    renderWithProviders(<TextInput label="Name" />);
  });

  it('Focus TextInput onPress <View>', () => {
    fireEvent.press(screen.getByRole('text'));
    expect(screen.queryByA11yHint('Nome da via')).not.toBeNull();
  });
  it('set isFocused to false onBlur <TextInput>', () => {
    fireEvent.press(screen.getByRole('text'));
    fireEvent(screen.getByA11yHint('Nome da via'), 'blur');
    expect(screen.queryByA11yHint('Nome da via')).toBeNull();
  });
});
