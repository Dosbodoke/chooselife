import { Stack } from 'expo-router';
import React from 'react';

import { OrganizationProvider } from '@chooselife/ui';
import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

export default function OrganizationsLayout() {
  const { session } = useAuth();

  return (
    <OrganizationProvider supabase={supabase} userId={session?.user.id}>
      <Stack>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="[slug]/member"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </OrganizationProvider>
  );
}
