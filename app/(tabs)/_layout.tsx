import { Tabs } from "expo-router";

import { cn } from "~/lib/utils";
import { User } from "~/lib/icons/User";
import { Earth } from "~/lib/icons/Earth";
import { Trophy } from "~/lib/icons/Trophy";
import { Settings } from "~/lib/icons/Settings";

// Custom styled tab bar
// import TabBar from "~/components/tab-bar";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Explorar",
          tabBarIcon: ({ focused }) => (
            <Earth
              className={cn(
                "w-4 h-4",
                focused ? "text-blue-500" : "text-muted-foreground"
              )}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          headerShown: false,
          title: "Ranking",
          tabBarIcon: ({ focused }) => (
            <Trophy
              className={cn(
                "w-4 h-4",
                focused ? "text-blue-500" : "text-muted-foreground"
              )}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerShown: false,
          title: "Configurações",
          tabBarIcon: ({ focused }) => (
            <Settings
              className={cn(
                "w-4 h-4",
                focused ? "text-blue-500" : "text-muted-foreground"
              )}
            />
          ),
        }}
      />
    </Tabs>
  );
}
