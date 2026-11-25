import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAuth } from '~/context/auth';
import {
  KubaiGlobeIcon,
  KubaiTentIcon,
  KubaiUserRoundIcon,
  KubaiUsersRoundIcon,
} from '~/lib/icons/kubai';
import { cn } from '~/lib/utils';

import { FloatingTabBar } from '~/components/floating-tab-bar';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Icon } from '~/components/ui/icon';

export default function TabLayout() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  // The floating bar owns its own visibility (keyboard, Explore's highline
  // cards), so the screens below only declare titles and icons.
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('app.(tabs)._layout.homeTitle'),
          tabBarIcon: ({ focused }) => (
            <Icon
              as={KubaiTentIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-foreground',
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
          tabBarIcon: ({ focused }) => (
            <Icon
              as={KubaiGlobeIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-foreground',
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
              as={KubaiUsersRoundIcon}
              className={cn(
                'size-6',
                focused ? 'text-blue-500' : 'text-foreground',
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
          tabBarIcon: ({ focused }) =>
            profile ? (
              <View
                className={cn(
                  'size-7 rounded-full',
                  focused && 'border-2 border-blue-500',
                )}
              >
                <SupabaseAvatar profileID={profile.id} />
              </View>
            ) : (
              <Icon
                as={KubaiUserRoundIcon}
                className={cn(
                  'size-6',
                  focused ? 'text-blue-500' : 'text-foreground',
                )}
              />
            ),
        }}
      />
    </Tabs>
  );
}
