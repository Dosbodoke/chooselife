import { Stack } from 'expo-router';
import React from 'react';

export default function OrganizationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="[slug]" />
      <Stack.Screen
        name="member"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          animationDuration: 300,
        }}
      />
    </Stack>
  );
}
