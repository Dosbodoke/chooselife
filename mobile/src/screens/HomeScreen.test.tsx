/* eslint-disable @typescript-eslint/no-explicit-any */

import renderer from 'react-test-renderer';

import HomeScreen from './HomeScreen';

describe('', () => {
  it('Render a map', () => {
    const tree: any = renderer.create(<HomeScreen />).toJSON();
    expect(tree?.children?.find((node: { type: string }) => node.type === 'AIRMap')).toBeDefined();
  });
});
