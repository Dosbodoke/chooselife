import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: t('app.(tabs)._layout.indexTitle'),
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ focused }) => (
            <LucideIcon
              name="Earth"
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
            <LucideIcon
              name="Settings"
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
