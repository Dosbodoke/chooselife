import { Stack } from 'expo-router';
import React from 'react';

export default function OrganizationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[slug]/member"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
