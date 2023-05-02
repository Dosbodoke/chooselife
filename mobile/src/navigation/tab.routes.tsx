import { type NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MapRoutes, { type MapStackParamList } from './map.routes';

import { Profile } from '@src/screens';
import { GlobeSvg, ProfileSvg } from '@src/assets';

export type TabParamList = {
  Map: NavigatorScreenParams<MapStackParamList>;
  Profile: { userId: string };
};

const Tab = createBottomTabNavigator<TabParamList>();

const TabRoutes: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen
      name="Map"
      component={MapRoutes}
      options={{
        tabBarIcon: ({ color, size }) => <GlobeSvg color={color} width={size} height={size} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={Profile}
      options={{
        tabBarIcon: ({ color, size }) => <ProfileSvg color={color} width={size} height={size} />,
      }}
    />
  </Tab.Navigator>
);

export default TabRoutes;
