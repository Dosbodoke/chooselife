import { renderWithProviders, createTestProps } from '@src/utils/test-utils';

import MapTypeScreen from '../MapTypeScreen';

describe('MapTypeScreen', () => {
  it('Show all map types', () => {
    // given
    const props: any = createTestProps({});
    const { getByText } = renderWithProviders(<MapTypeScreen {...props} />);

    // then
    expect(getByText('Padrão')).toBeDefined();
    expect(getByText('Satélite')).toBeDefined();
    expect(getByText('Terreno')).toBeDefined();
  });
});
