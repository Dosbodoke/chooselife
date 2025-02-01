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
        name="register"
        options={{
          presentation: 'modal',
          title: 'Registrar rolê',
        }}
      />
      <Stack.Screen
        name="rig"
        options={{
          headerShown: false,
          presentation: 'modal',
          title: 'Montar highline',
        }}
      />
    </Stack>
  );
}
