import { Stack } from "expo-router";

export default function HighlineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]/register"
        options={{
          presentation: "modal",
          title: "Registrar rolê",
        }}
      />
    </Stack>
  );
}
