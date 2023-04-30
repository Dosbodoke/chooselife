import { useLayoutEffect, useMemo } from 'react';

import { TabParamList } from '@src/navigation/tab.routes';
import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

const useTabDisplay = <TabScreen extends keyof TabParamList, Stack>({
  navigation,
  route,
  screens,
}: BottomTabScreenProps<TabParamList, TabScreen> & {
  screens: Array<keyof Stack>;
}) => {
  const visibleRoutes = useMemo(() => screens, []);

  useLayoutEffect(() => {
    const routeName = getFocusedRouteNameFromRoute(route) as keyof Stack;
    navigation.setOptions({
      tabBarStyle: {
        display:
          // When the "Home" screen renders for the first time, the routeName is undefined
          routeName === undefined || visibleRoutes.includes(routeName) ? 'flex' : 'none',
      },
    });
  }, [navigation, route]);
};

export default useTabDisplay;
