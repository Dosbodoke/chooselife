import { Tabs } from 'expo-router';
import {
  EarthIcon,
  TentTreeIcon,
  UserCircleIcon,
  UsersRoundIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: t('app.(tabs)._layout.homeTitle'),
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ focused }) => (
            <Icon
              as={TentTreeIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-muted-foreground',
              )}
            />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('app.(tabs)._layout.indexTitle'),
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ focused }) => (
            <Icon
              as={EarthIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-muted-foreground',
              )}
            />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="organizations"
        options={{
          title: 'SL.A.C',
          tabBarLabel: 'SL.A.C',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Icon
              as={UsersRoundIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-muted-foreground',
              )}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('app.(tabs)._layout.settingsTitle'),
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Icon
              as={UserCircleIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-muted-foreground',
              )}
            />
          ),
        }}
      />
    </Tabs>
  );
}
