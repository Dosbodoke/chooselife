import { Link } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/context/auth";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  if (user) {
    return (
      <SafeAreaView className="flex-1">
        <View className="p-4">
          <Button variant="link" onPress={signOut}>
            <Text className="text-foreground underline">Sair da conta</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <View className="p-4">
        <Link
          href={`/login?redirect_to=settings`}
          className="w-full bg-primary text-center py-4 text-primary-foreground"
        >
          Entrar
        </Link>
      </View>
    </SafeAreaView>
  );
}
