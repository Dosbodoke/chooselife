import { Tabs } from 'expo-router';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

// Custom styled tab bar
// import TabBar from "~/components/tab-bar";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explorar',
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
          headerShown: false,
          title: 'Configurações',
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
