import { Stack } from 'expo-router';

export default function HighlineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerShown: true,
          title: '',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="rig"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
